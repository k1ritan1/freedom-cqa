import asyncio
import json
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from backend.config import PORT, GROQ_MODEL, ASSETS_DIR, STATIC_DIR
from backend.database import init_db, get_db
from backend.checklist_service import get_active_checklist, update_checklist, calculate_cqa_scores
from backend.sync_service import fetch_and_sync_dataset, get_all_dialogues, get_dialogue_detail
from backend.groq_evaluator import evaluate_dialogue_with_groq, save_evaluation

# Initialize database on startup
init_db()

app = FastAPI(title="Freedom Broker CQA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Background batch evaluation state
batch_state = {
    "is_running": False,
    "total": 0,
    "completed": 0,
    "failed": 0,
    "current_id": ""
}

class BatchEvaluateRequest(BaseModel):
    group_id: str = "DEV"
    reevaluate_all: bool = False

class ChecklistUpdateRequest(BaseModel):
    name: str
    criteria: List[Dict[str, Any]]

class AppealCreateRequest(BaseModel):
    conversation_id: str
    evaluation_id: Optional[str] = None
    criterion_id: str
    proposed_score: float
    operator_comment: str

class AppealResolveRequest(BaseModel):
    status: str  # 'approved' or 'rejected'
    supervisor_comment: str
    resolved_score: Optional[float] = None

class SyncRequest(BaseModel):
    group_id: str = "DEV"

@app.get("/api/health")
def health():
    return {"status": "ok", "model": GROQ_MODEL, "provider": "Groq"}

@app.get("/api/checklist/active")
def get_checklist():
    return get_active_checklist()

@app.put("/api/checklist/active")
def set_checklist(payload: ChecklistUpdateRequest):
    chk = get_active_checklist()
    updated = update_checklist(chk["id"], payload.name, payload.criteria)
    return updated

@app.post("/api/sync")
def sync_dataset(payload: SyncRequest):
    try:
        res = fetch_and_sync_dataset(payload.group_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/dialogues")
def list_dialogues(
    group_id: str = "DEV",
    channel: Optional[str] = None,
    language: Optional[str] = None,
    status: Optional[str] = None
):
    all_d = get_all_dialogues(group_id)
    filtered = all_d
    if channel:
        filtered = [d for d in filtered if d["channel"] == channel]
    if language:
        filtered = [d for d in filtered if d["language"] == language]
    if status:
        if status == "evaluated":
            filtered = [d for d in filtered if d["eval_status"] == "completed"]
        elif status == "pending":
            filtered = [d for d in filtered if d["eval_status"] == "pending"]
        elif status == "violation":
            filtered = [d for d in filtered if d["severe_violation"]]
        elif status == "appeals":
            filtered = [d for d in filtered if d["appeals_count"] > 0]
    return {"group_id": group_id, "total": len(filtered), "records": filtered}

@app.get("/api/dialogues/{conversation_id}")
def get_dialogue(conversation_id: str):
    dlg = get_dialogue_detail(conversation_id)
    if not dlg:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    return dlg

async def run_batch_evaluation_task(group_id: str, reevaluate_all: bool = False):
    global batch_state
    batch_state["is_running"] = True
    batch_state["failed"] = 0
    
    dialogues = get_all_dialogues(group_id)
    if not reevaluate_all:
        targets = [d for d in dialogues if d["eval_status"] != "completed"]
    else:
        targets = dialogues
        
    batch_state["total"] = len(targets)
    batch_state["completed"] = 0
    
    chk = get_active_checklist()
    
    for d in targets:
        cid = d["conversation_id"]
        batch_state["current_id"] = cid
        dlg = get_dialogue_detail(cid)
        if dlg:
            try:
                eval_res = await asyncio.to_thread(
                    evaluate_dialogue_with_groq,
                    dlg["conversation_id"],
                    dlg["transcript"],
                    chk["criteria"]
                )
                save_evaluation(dlg["conversation_id"], chk["id"], eval_res)
                batch_state["completed"] += 1
            except Exception as e:
                print(f"Error evaluating {cid}: {e}")
                batch_state["failed"] += 1
        await asyncio.sleep(1.0)
        
    batch_state["is_running"] = False
    batch_state["current_id"] = ""

@app.post("/api/evaluate/batch")
def start_batch_evaluation(background_tasks: BackgroundTasks, payload: Optional[BatchEvaluateRequest] = None):
    global batch_state
    if batch_state["is_running"]:
        return {"status": "already_running", "progress": batch_state}
    group_id = payload.group_id if payload else "DEV"
    reevaluate_all = payload.reevaluate_all if payload else False
    background_tasks.add_task(run_batch_evaluation_task, group_id, reevaluate_all)
    return {"status": "started", "progress": batch_state}

@app.get("/api/evaluate/progress")
def get_batch_progress():
    return batch_state

@app.post("/api/evaluate/{conversation_id}")
def evaluate_single(conversation_id: str):
    dlg = get_dialogue_detail(conversation_id)
    if not dlg:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    chk = get_active_checklist()
    try:
        eval_res = evaluate_dialogue_with_groq(dlg["conversation_id"], dlg["transcript"], chk["criteria"])
        save_evaluation(dlg["conversation_id"], chk["id"], eval_res)
        return get_dialogue_detail(conversation_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/appeals")
def create_appeal(payload: AppealCreateRequest):
    conn = get_db()
    cursor = conn.cursor()
    
    dlg = get_dialogue_detail(payload.conversation_id)
    if not dlg or not dlg.get("evaluation"):
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot appeal dialogue without evaluation")
        
    eval_id = dlg["evaluation"]["id"]
    criteria_res = dlg["evaluation"]["criteria_results"].get(payload.criterion_id, {})
    original_score = criteria_res.get("raw_score", 0.0)
    
    cursor.execute("""
        INSERT INTO appeals (
            conversation_id, evaluation_id, criterion_id, original_score, proposed_score, operator_comment
        ) VALUES (?, ?, ?, ?, ?, ?)
    """, (payload.conversation_id, eval_id, payload.criterion_id, original_score, payload.proposed_score, payload.operator_comment))
    
    appeal_id = cursor.lastrowid
    
    cursor.execute("""
        INSERT INTO audit_logs (conversation_id, action, details_json)
        VALUES (?, 'APPEAL_CREATED', ?)
    """, (payload.conversation_id, json.dumps({
        "appeal_id": appeal_id,
        "criterion_id": payload.criterion_id,
        "proposed": payload.proposed_score
    }, ensure_ascii=False)))
    
    conn.commit()
    conn.close()
    return {"appeal_id": appeal_id, "status": "pending"}

@app.get("/api/appeals/pending")
def get_pending_appeals():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.*, d.language, d.channel
        FROM appeals a
        JOIN dialogues d ON a.conversation_id = d.conversation_id
        WHERE a.status = 'pending'
        ORDER BY a.created_at DESC
    """)
    rows = cursor.fetchall()
    res = [dict(r) for r in rows]
    conn.close()
    return res

@app.post("/api/appeals/{appeal_id}/resolve")
def resolve_appeal(appeal_id: int, payload: AppealResolveRequest):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM appeals WHERE id = ?", (appeal_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Appeal not found")
        
    resolved_score = payload.resolved_score if payload.resolved_score is not None else row["proposed_score"]
    if payload.status == "rejected":
        resolved_score = row["original_score"]
        
    cursor.execute("""
        UPDATE appeals
        SET status = ?, supervisor_comment = ?, resolved_score = ?, resolved_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (payload.status, payload.supervisor_comment, resolved_score, appeal_id))
    
    conv_id = row["conversation_id"]
    criterion_id = row["criterion_id"]
    
    # Recalculate evaluation if appeal approved
    if payload.status == "approved":
        dlg = get_dialogue_detail(conv_id)
        if dlg and dlg.get("evaluation"):
            chk = get_active_checklist()
            criteria_res = dlg["evaluation"]["criteria_results"]
            
            if criterion_id in criteria_res:
                crit_def = next((c for c in chk["criteria"] if c["id"] == criterion_id), None)
                if crit_def:
                    if crit_def["type"] in ["YES_NO", "YES_NO_NA"]:
                        criteria_res[criterion_id]["status"] = "YES" if resolved_score > 0 else "NO"
                        criteria_res[criterion_id]["raw_score"] = 1.0 if resolved_score > 0 else 0.0
                    else:
                        criteria_res[criterion_id]["status"] = "SCALE"
                        criteria_res[criterion_id]["raw_score"] = float(resolved_score)
                    criteria_res[criterion_id]["reasoning"] += f" [Пересмотрено проверяющим: {payload.supervisor_comment}]"
                    
            raw_input = {}
            for cid, cval in criteria_res.items():
                raw_input[cid] = {
                    "status": cval["status"],
                    "raw_score": cval["raw_score"],
                    "is_na": cval.get("is_na", False),
                    "reasoning": cval.get("reasoning", ""),
                    "quote": cval.get("quote", ""),
                    "quote_timestamp": cval.get("quote_timestamp", "")
                }
            new_cqa = calculate_cqa_scores(raw_input, chk["criteria"])
            
            cursor.execute("""
                UPDATE evaluations
                SET total_score = ?, criteria_results_json = ?, section_scores_json = ?, chess_badge = ?
                WHERE id = ?
            """, (
                new_cqa["total_score"],
                json.dumps(new_cqa["criteria_results"], ensure_ascii=False),
                json.dumps(new_cqa["section_scores"], ensure_ascii=False),
                new_cqa["chess_badge"],
                dlg["evaluation"]["id"]
            ))
            
    cursor.execute("""
        INSERT INTO audit_logs (conversation_id, action, details_json)
        VALUES (?, 'APPEAL_RESOLVED', ?)
    """, (conv_id, json.dumps({
        "appeal_id": appeal_id,
        "status": payload.status,
        "resolved_score": resolved_score
    }, ensure_ascii=False)))
    
    conn.commit()
    conn.close()
    return get_dialogue_detail(conv_id)

@app.get("/api/analytics")
def get_analytics(group_id: str = "DEV"):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            COUNT(d.conversation_id) as total_dialogues,
            SUM(CASE WHEN e.status = 'completed' THEN 1 ELSE 0 END) as evaluated_count,
            AVG(CASE WHEN e.status = 'completed' THEN e.total_score ELSE NULL END) as avg_score,
            SUM(CASE WHEN e.severe_violation = 1 THEN 1 ELSE 0 END) as severe_violations_count,
            SUM(CASE WHEN e.status = 'completed' THEN e.cost_usd ELSE 0 END) as total_cost_usd,
            AVG(CASE WHEN e.status = 'completed' THEN e.latency_ms ELSE NULL END) as avg_latency_ms,
            (SELECT COUNT(*) FROM appeals) as total_appeals,
            (SELECT COUNT(*) FROM appeals WHERE status = 'pending') as pending_appeals
        FROM dialogues d
        LEFT JOIN evaluations e ON d.conversation_id = e.conversation_id
        WHERE d.dataset_group_id = ?
    """, (group_id,))
    row = cursor.fetchone()
    
    cursor.execute("""
        SELECT language, COUNT(*) as cnt, AVG(e.total_score) as avg_score
        FROM dialogues d
        LEFT JOIN evaluations e ON d.conversation_id = e.conversation_id
        WHERE d.dataset_group_id = ?
        GROUP BY language
    """, (group_id,))
    lang_stats = [{"language": r["language"], "count": r["cnt"], "avg_score": round(r["avg_score"] or 0, 2)} for r in cursor.fetchall()]
    
    conn.close()
    return {
        "group_id": group_id,
        "total_dialogues": row["total_dialogues"] or 0,
        "evaluated_count": row["evaluated_count"] or 0,
        "avg_score": round(row["avg_score"] or 0, 2),
        "severe_violations_count": row["severe_violations_count"] or 0,
        "total_cost_usd": round(row["total_cost_usd"] or 0, 4),
        "avg_latency_ms": int(row["avg_latency_ms"] or 0),
        "total_appeals": row["total_appeals"] or 0,
        "pending_appeals": row["pending_appeals"] or 0,
        "languages": lang_stats
    }

# Mount assets directory (for chess icons in /assets/rating icons/...)
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

# Mount static directory
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
def serve_root():
    return FileResponse(str(STATIC_DIR / "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host="0.0.0.0", port=PORT, reload=False)
