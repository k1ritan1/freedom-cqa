import json
import time
import re
import urllib.request
import urllib.error
from typing import Dict, Any, List
from backend.config import GROQ_API_KEY, GROQ_MODEL, GEMINI_API_KEY
from backend.checklist_service import calculate_cqa_scores
from backend.database import get_db

PROMPT_PER_TOKEN_USD = 0.00000015  # $0.15 / 1M tokens
COMPLETION_PER_TOKEN_USD = 0.0000006  # $0.60 / 1M tokens

SYSTEM_PROMPT = """Вы — старший аудитор контроля качества обслуживания Freedom Broker (Conversation Quality Analytics).
Ваша задача: строго, объективно и беспристрастно оценить работу ОПЕРАТОРА (speaker: 'operator') в предоставленном клиентском диалоге согласно правилам чек-листа Freedom Broker.

Язык диалога может быть русским (RU), казахским (KZ) или английским (EN).
ВАЖНОЕ ТРЕБОВАНИЕ К ЯЗЫКУ ОТЧЕТА: Все обоснования (reasoning) и итоговое резюме (summary_feedback) ВСЕГДА пишите на грамотном, профессиональном РУССКОМ языке, независимо от языка самого диалога!

Реплики бота (speaker: 'bot') и системные сообщения (speaker: 'system') служат контекстом, но оценивается ТОЛЬКО оператор.

Правила применения чек-листа:
1. "Установление контакта" (01): "YES" если оператор поздоровался на языке клиента И представился в первом ответе (например: "Здравствуйте! Меня зовут Алина"). Если не представился или не поздоровался — "NO", raw_score: 0. N/A запрещен.
2. "Выявление потребности" (02): "YES" если оператор учёл детали и уточнил недостающее до ответа. "NA" если данных для ответа хватало с самого начала (клиент сразу дал все вводные). "NO" если данных не хватало, но оператор не уточнил (raw_score: 0).
3. "Идентификация" (03): "YES" если проверка личности подтверждена до раскрытия конфиденциальных данных или защищенного действия (счета, баланс, личные данные, тарифный план клиента). "NA" если общий вопрос (общие тарифы, общие условия, адреса филиалов) не требовал идентификации. "NO" если требовалась, но не проведена или данные раскрыты без верификации (raw_score: 0).
4. "Корректная и полная консультация" (04): Выберите одну из ступеней шкалы:
   - 20: Все существенные вопросы закрыты или дан корректный следующий шаг.
   - 15: Основной вопрос решён, пропущена второстепенная деталь.
   - 10: Часть запроса закрыта, существенный вопрос остался открытым.
   - 5: Есть общая подсказка, но клиенту всё ещё непонятно, как действовать.
   - 0: Ответа по существу нет или ключевая рекомендация ошибочна.
   "NA" — ТОЛЬКО если чат закончился до того, как клиент сформулировал запрос.
5. "Эмпатия и клиентоориентированность" (05): "YES" если оператор вежлив, а при недовольстве или описании неудобства клиентом отреагировал на конкретную проблему. "NO" при грубости, сухости или игнорировании явной проблемы (raw_score: 0). N/A запрещен.
6. "Управление диалогом, скорость и грамотность" (06): Выберите одну из ступеней шкалы (10 / 7 / 4 / 0):
   - 10: Ответы ясные и связные. Если было явное ожидание, оператор предупредил.
   - 7: Один заметный сбой, но клиент может понять ответ и продолжить.
   - 4: Клиенту приходится переспрашивать из-за формулировок или порядка ответов.
   - 0: Из-за бессвязных или противоречивых реплик ход диалога непонятен.
   Примечание: порог первой реакции в 3 минуты, теги и вложения в оценку не входят. N/A запрещен.
7. "Завершение" (07): "YES" если оператор подвёл итог или предложил дальнейшую помощь ("Остались ли у вас вопросы?") и попрощался. "NO" если закрыл без прощания/итога (raw_score: 0). "NA" если чат оборвался со стороны клиента до возможности его завершить.
8. "Грубые ошибки" (08): Отметьте выявлено (detected: true, status: "YES") ТОЛЬКО при:
   - Оскорблении клиента;
   - Предложении платной услуги в обход компании (например, перевод денег оператору лично);
   - Раскрытии конфиденциальной информации третьим лицам.
   Если ничего из этого нет — detected: false, status: "NO", raw_score: 0.

ПРАВИЛА ДЛЯ ЦИТАТ (quote) И ТАЙМКОДОВ (quote_timestamp):
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО копировать одну и ту же первую реплику оператора во все критерии подряд!
- Для каждого критерия найдите именно ту реплику оператора, которая относится к этому критерию:
  * 01 contact: цитата приветствия и представления из первой реплики.
  * 02 need: цитата уточнения потребности (или quote: "" если NA).
  * 03 identification: цитата запроса идентификации (если была). Если данные раскрыты без верификации (status: NO), процитируйте фразу, где оператор раскрыл закрытые данные. Если NA, quote: "".
  * 04 consultation: цитата консультации по существу запроса.
  * 05 empathy: цитата вежливости, поддержки или благодарности.
  * 06 dialogue_mgmt: цитата связующей фразы или предупреждения об ожидании.
  * 07 closing: цитата финального прощания / подведения итогов из последней реплики оператора.
  * 08 severe_errors: цитата нарушения (или quote: "" если чисто).
- Если статус "NA" (не требуется): quote ОБЯЗАТЕЛЬНО должна быть пустой строкой "", quote_timestamp: "".
- Если статус "NO" из-за пропуска обязательного действия (например, оператор вообще не попрощался), в reasoning опишите пропуск, а quote оставьте пустой строкой "".

ПРАВИЛА ДЛЯ raw_score:
- При status: "NO" -> raw_score: 0
- При status: "NA" -> raw_score: 0, is_na: true
- При status: "YES" -> raw_score: 1 (для 01, 02, 03, 05, 07)
- Для 04: 20, 15, 10, 5 или 0
- Для 06: 10, 7, 4 или 0

Отвечайте ИСКЛЮЧИТЕЛЬНО валидным JSON-объектом:
{
  "criteria_results": {
    "contact": { "status": "YES", "raw_score": 1, "is_na": false, "reasoning": "Русскоязычное подробное обоснование...", "quote": "...", "quote_timestamp": "01:15" },
    "need": { "status": "NA", "raw_score": 0, "is_na": true, "reasoning": "Русскоязычное обоснование...", "quote": "", "quote_timestamp": "" },
    "identification": { "status": "NO", "raw_score": 0, "is_na": false, "reasoning": "Русскоязычное обоснование...", "quote": "...", "quote_timestamp": "..." },
    "consultation": { "status": "SCALE", "raw_score": 20, "is_na": false, "reasoning": "Русскоязычное обоснование...", "quote": "...", "quote_timestamp": "..." },
    "empathy": { "status": "YES", "raw_score": 1, "is_na": false, "reasoning": "Русскоязычное обоснование...", "quote": "...", "quote_timestamp": "..." },
    "dialogue_mgmt": { "status": "SCALE", "raw_score": 10, "is_na": false, "reasoning": "Русскоязычное обоснование...", "quote": "...", "quote_timestamp": "..." },
    "closing": { "status": "YES", "raw_score": 1, "is_na": false, "reasoning": "Русскоязычное обоснование...", "quote": "...", "quote_timestamp": "..." },
    "severe_errors": { "status": "NO", "detected": false, "violation_type": "none", "reasoning": "Нарушений не выявлено.", "quote": "", "quote_timestamp": "" }
  },
  "summary_feedback": "Подробное резюме аудитора качества на русском языке с указанием сильных сторон и зон роста оператора."
}
"""

def clean_json_text(text: str) -> str:
    """Strips markdown ```json fences if present"""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()

def call_groq(user_prompt: str) -> Dict[str, Any]:
    req_body = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.05,
        "response_format": {"type": "json_object"}
    }
    
    max_retries = 5
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "curl/7.88.1"
                },
                data=json.dumps(req_body).encode("utf-8")
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                
            usage = resp_data.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            cost_usd = (prompt_tokens * PROMPT_PER_TOKEN_USD) + (completion_tokens * COMPLETION_PER_TOKEN_USD)
            raw_content = resp_data["choices"][0]["message"]["content"]
            
            return {
                "content": clean_json_text(raw_content),
                "model": GROQ_MODEL,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "cost_usd": round(cost_usd, 6)
            }
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                retry_after = e.headers.get("Retry-After")
                wait_sec = float(retry_after) if retry_after else (12 + attempt * 6)
                time.sleep(wait_sec)
                continue
            raise

def call_gemini_fallback(user_prompt: str) -> Dict[str, Any]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={GEMINI_API_KEY}"
    req_body = {
        "contents": [
            {"role": "user", "parts": [{"text": SYSTEM_PROMPT + "\n\n" + user_prompt}]}
        ],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }
    req = urllib.request.Request(
        url,
        headers={"Content-Type": "application/json"},
        data=json.dumps(req_body).encode("utf-8")
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        resp_data = json.loads(resp.read().decode("utf-8"))
        
    candidate = resp_data.get("candidates", [])[0]
    raw_content = candidate.get("content", {}).get("parts", [])[0].get("text", "{}")
    usage = resp_data.get("usageMetadata", {})
    prompt_tokens = usage.get("promptTokenCount", 0)
    completion_tokens = usage.get("candidatesTokenCount", 0)
    cost_usd = (prompt_tokens * 0.0000001) + (completion_tokens * 0.0000004)
    
    return {
        "content": clean_json_text(raw_content),
        "model": "gemini-2.5-flash (fallback)",
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": round(cost_usd, 6)
    }

def evaluate_dialogue_with_groq(conversation_id: str, transcript: List[Dict[str, Any]], criteria: List[Dict[str, Any]]) -> Dict[str, Any]:
    start_time = time.time()
    
    # Format transcript text
    transcript_lines = []
    for msg in transcript:
        ts = msg.get("timestamp", "")
        spk = msg.get("speaker", "unknown")
        txt = msg.get("text", "")
        transcript_lines.append(f"[{ts}] {spk}: {txt}")
    transcript_str = "\n".join(transcript_lines)
    
    # Format active criteria definitions dynamically
    crit_desc_list = []
    for c in criteria:
        scale_info = ""
        if c.get("scale_rubric"):
            steps = ", ".join([f"{s['val']} ({s['desc']})" for s in c["scale_rubric"]])
            scale_info = f" Шкала: [{steps}]."
        crit_desc_list.append(
            f"- ID '{c['id']}' ({c['code']} {c['name']}, вес {c['weight']}, N/A разрешен: {c['allow_na']}): {c['description']}{scale_info}"
        )
    dynamic_criteria_str = "\n".join(crit_desc_list)
    
    user_prompt = f"""ДИАЛОГ: {conversation_id}
СПИСОК КРИТЕРИЕВ:
{dynamic_criteria_str}

ТРАНСКРИПТ ДИАЛОГА:
{transcript_str}

Оцените диалог по каждому критерию строго в формате JSON."""

    try:
        call_res = call_groq(user_prompt)
    except Exception as e:
        print(f"[Evaluator] Groq call issue ({e}), using Gemini fallback...")
        if GEMINI_API_KEY:
            call_res = call_gemini_fallback(user_prompt)
        else:
            raise
            
    latency_ms = int((time.time() - start_time) * 1000)
    parsed = json.loads(call_res["content"])
    
    raw_evaluations = parsed.get("criteria_results", {})
    summary_feedback = parsed.get("summary_feedback", "")
    
    # Normalize is_na flag, status and raw_scores
    for cid, val in raw_evaluations.items():
        st = str(val.get("status", "")).strip().upper()
        if st in ("NA", "N/A") or val.get("is_na") is True:
            val["is_na"] = True
            val["status"] = "NA"
            val["raw_score"] = 0.0
            val["quote"] = ""
            val["quote_timestamp"] = ""
        elif st in ("NO", "FALSE", "0"):
            val["status"] = "NO"
            val["raw_score"] = 0.0
        elif st in ("YES", "TRUE", "1"):
            val["status"] = "YES"
            if cid in ("contact", "need", "identification", "empathy", "closing"):
                val["raw_score"] = 1.0
    
    # Calculate CQA Scores with N/A redistribution and chess badges
    cqa_calc = calculate_cqa_scores(raw_evaluations, criteria)
    
    return {
        "conversation_id": conversation_id,
        "total_score": cqa_calc["total_score"],
        "severe_violation": cqa_calc["severe_violation"],
        "chess_badge": cqa_calc["chess_badge"],
        "criteria_results": cqa_calc["criteria_results"],
        "section_scores": cqa_calc["section_scores"],
        "summary_feedback": summary_feedback,
        "model_used": call_res["model"],
        "prompt_tokens": call_res["prompt_tokens"],
        "completion_tokens": call_res["completion_tokens"],
        "cost_usd": call_res["cost_usd"],
        "latency_ms": latency_ms,
        "redistributed": cqa_calc["redistributed"]
    }

def save_evaluation(conv_id: str, checklist_id: str, eval_data: Dict[str, Any]) -> None:
    conn = get_db()
    cursor = conn.cursor()
    
    eval_id = f"eval_{conv_id}_{int(time.time())}"
    cursor.execute("""
        INSERT INTO evaluations (
            id, conversation_id, checklist_id, status, total_score, severe_violation, chess_badge,
            criteria_results_json, section_scores_json, summary_feedback,
            model_used, prompt_tokens, completion_tokens, cost_usd, latency_ms
        ) VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(conversation_id) DO UPDATE SET
            id = excluded.id,
            checklist_id = excluded.checklist_id,
            status = 'completed',
            total_score = excluded.total_score,
            severe_violation = excluded.severe_violation,
            chess_badge = excluded.chess_badge,
            criteria_results_json = excluded.criteria_results_json,
            section_scores_json = excluded.section_scores_json,
            summary_feedback = excluded.summary_feedback,
            model_used = excluded.model_used,
            prompt_tokens = excluded.prompt_tokens,
            completion_tokens = excluded.completion_tokens,
            cost_usd = excluded.cost_usd,
            latency_ms = excluded.latency_ms
    """, (
        eval_id,
        conv_id,
        checklist_id,
        eval_data["total_score"],
        1 if eval_data["severe_violation"] else 0,
        eval_data.get("chess_badge", "Book"),
        json.dumps(eval_data["criteria_results"], ensure_ascii=False),
        json.dumps(eval_data["section_scores"], ensure_ascii=False),
        eval_data.get("summary_feedback", ""),
        eval_data.get("model_used", GROQ_MODEL),
        eval_data.get("prompt_tokens", 0),
        eval_data.get("completion_tokens", 0),
        eval_data.get("cost_usd", 0.0),
        eval_data.get("latency_ms", 0)
    ))
    
    cursor.execute("""
        INSERT INTO audit_logs (conversation_id, action, details_json)
        VALUES (?, 'EVALUATED', ?)
    """, (conv_id, json.dumps({
        "total_score": eval_data["total_score"],
        "chess_badge": eval_data.get("chess_badge"),
        "model": eval_data.get("model_used")
    }, ensure_ascii=False)))
    
    conn.commit()
    conn.close()
