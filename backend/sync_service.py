import json
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Optional
from backend.config import DATASET_API_BASE
from backend.database import get_db

def fetch_and_sync_dataset(group_id: str = "DEV") -> Dict[str, Any]:
    """
    Fetches the dataset from the organizers' PowerAutomate API using group_id
    and syncs records into SQLite.
    """
    parsed = urllib.parse.urlparse(DATASET_API_BASE)
    query_params = urllib.parse.parse_qs(parsed.query)
    query_params["group_id"] = [group_id]
    new_query = urllib.parse.urlencode(query_params, doseq=True)
    full_url = urllib.parse.urlunparse(parsed._replace(query=new_query))
    
    req = urllib.request.Request(
        full_url,
        headers={"User-Agent": "curl/7.88.1"}
    )
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read().decode("utf-8")
        data = json.loads(body)
        
    if not data.get("isSuccess"):
        raise RuntimeError(f"API returned error: {data.get('error')}")
        
    records = data.get("data", {}).get("records", [])
    conn = get_db()
    cursor = conn.cursor()
    
    synced_count = 0
    for rec in records:
        conv_id = rec.get("conversation_id")
        channel = rec.get("channel", "agent chat")
        language = rec.get("language", "RU")
        transcript = rec.get("transcript", [])
        audio_url = rec.get("audio_url")
        
        cursor.execute("""
            INSERT INTO dialogues (
                conversation_id, dataset_group_id, channel, language, transcript_json, audio_url
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(conversation_id) DO UPDATE SET
                dataset_group_id = excluded.dataset_group_id,
                channel = excluded.channel,
                language = excluded.language,
                transcript_json = excluded.transcript_json,
                audio_url = excluded.audio_url
        """, (
            conv_id,
            group_id,
            channel,
            language,
            json.dumps(transcript, ensure_ascii=False),
            audio_url
        ))
        synced_count += 1
        
    conn.commit()
    conn.close()
    
    return {
        "status": "success",
        "dataset_group_id": group_id,
        "synced_records": synced_count,
        "total_in_response": len(records)
    }

def get_all_dialogues(group_id: str = "DEV") -> List[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            d.conversation_id,
            d.dataset_group_id,
            d.channel,
            d.language,
            d.audio_url,
            d.transcript_json,
            e.status as eval_status,
            e.total_score,
            e.severe_violation,
            e.chess_badge,
            (SELECT COUNT(*) FROM appeals a WHERE a.conversation_id = d.conversation_id) as appeals_count,
            (SELECT COUNT(*) FROM appeals a WHERE a.conversation_id = d.conversation_id AND a.status = 'pending') as pending_appeals_count
        FROM dialogues d
        LEFT JOIN evaluations e ON d.conversation_id = e.conversation_id
        WHERE d.dataset_group_id = ?
        ORDER BY d.conversation_id ASC
    """, (group_id,))
    
    rows = cursor.fetchall()
    dialogues = []
    for r in rows:
        client_snippet = ""
        msg_count = 0
        try:
            transcript = json.loads(r["transcript_json"] or "[]")
            msg_count = len(transcript)
            for msg in transcript:
                if msg.get("speaker") == "client" and msg.get("text"):
                    client_snippet = msg["text"].strip()
                    break
            if not client_snippet and transcript:
                client_snippet = transcript[0].get("text", "").strip()
        except Exception:
            pass

        dialogues.append({
            "conversation_id": r["conversation_id"],
            "dataset_group_id": r["dataset_group_id"],
            "channel": r["channel"],
            "language": r["language"],
            "has_audio": bool(r["audio_url"]),
            "client_snippet": client_snippet,
            "message_count": msg_count,
            "eval_status": r["eval_status"] or "pending",
            "total_score": round(r["total_score"] or 0.0, 2),
            "severe_violation": bool(r["severe_violation"]),
            "chess_badge": r["chess_badge"] or ("Blunder" if r["severe_violation"] else "Book"),
            "appeals_count": r["appeals_count"],
            "pending_appeals_count": r["pending_appeals_count"]
        })
    conn.close()
    return dialogues

def get_dialogue_detail(conversation_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM dialogues WHERE conversation_id = ?", (conversation_id,))
    d_row = cursor.fetchone()
    if not d_row:
        conn.close()
        return None
        
    cursor.execute("SELECT * FROM evaluations WHERE conversation_id = ?", (conversation_id,))
    e_row = cursor.fetchone()
    
    cursor.execute("SELECT * FROM appeals WHERE conversation_id = ? ORDER BY created_at DESC", (conversation_id,))
    a_rows = cursor.fetchall()
    
    evaluation = None
    if e_row:
        evaluation = {
            "id": e_row["id"],
            "status": e_row["status"],
            "total_score": round(e_row["total_score"], 2),
            "severe_violation": bool(e_row["severe_violation"]),
            "chess_badge": e_row["chess_badge"] or ("Blunder" if e_row["severe_violation"] else "Book"),
            "criteria_results": json.loads(e_row["criteria_results_json"]),
            "section_scores": json.loads(e_row["section_scores_json"]),
            "summary_feedback": e_row["summary_feedback"],
            "model_used": e_row["model_used"],
            "prompt_tokens": e_row["prompt_tokens"],
            "completion_tokens": e_row["completion_tokens"],
            "cost_usd": round(e_row["cost_usd"], 6),
            "latency_ms": e_row["latency_ms"],
            "created_at": e_row["created_at"]
        }
        
    appeals = []
    for a in a_rows:
        appeals.append({
            "id": a["id"],
            "criterion_id": a["criterion_id"],
            "original_score": a["original_score"],
            "proposed_score": a["proposed_score"],
            "operator_comment": a["operator_comment"],
            "status": a["status"],
            "supervisor_comment": a["supervisor_comment"],
            "resolved_score": a["resolved_score"],
            "created_at": a["created_at"],
            "resolved_at": a["resolved_at"]
        })
        
    conn.close()
    
    return {
        "conversation_id": d_row["conversation_id"],
        "dataset_group_id": d_row["dataset_group_id"],
        "channel": d_row["channel"],
        "language": d_row["language"],
        "transcript": json.loads(d_row["transcript_json"]),
        "audio_url": d_row["audio_url"],
        "evaluation": evaluation,
        "appeals": appeals
    }
