import json
from typing import Dict, List, Any, Optional
from backend.database import get_db

DEFAULT_CRITERIA: List[Dict[str, Any]] = [
    {
        "id": "contact",
        "code": "01",
        "name": "Установление контакта",
        "section": "НАЧАЛО И ПОНИМАНИЕ ЗАПРОСА",
        "type": "YES_NO",
        "weight": 10,
        "allow_na": False,
        "max_scale": 1,
        "description": "Да — оператор поздоровался на языке клиента и представился в первом ответе. Нет — приветствие или представление отсутствует.",
        "scale_rubric": None
    },
    {
        "id": "need",
        "code": "02",
        "name": "Выявление потребности",
        "section": "НАЧАЛО И ПОНИМАНИЕ ЗАПРОСА",
        "type": "YES_NO_NA",
        "weight": 15,
        "allow_na": True,
        "max_scale": 1,
        "description": "Да — оператор учёл известные детали и уточнил недостающее до ответа. Нет — оператор не уточнил недостающие детали. N/A — данных для ответа хватало с самого начала.",
        "scale_rubric": None
    },
    {
        "id": "identification",
        "code": "03",
        "name": "Идентификация",
        "section": "БЕЗОПАСНОСТЬ И РЕШЕНИЕ",
        "type": "YES_NO_NA",
        "weight": 20,
        "allow_na": True,
        "max_scale": 1,
        "description": "Да — проверка личности подтверждена до раскрытия данных или защищённого действия. Нет — действие выполнено без требуемой идентификации. N/A — общий вопрос/запрос не требовал идентификации.",
        "scale_rubric": None
    },
    {
        "id": "consultation",
        "code": "04",
        "name": "Корректная и полная консультация",
        "section": "БЕЗОПАСНОСТЬ И РЕШЕНИЕ",
        "type": "SCALE_NA",
        "weight": 20,
        "allow_na": True,
        "max_scale": 20,
        "description": "Оцените ответ или следующий шаг по шкале (20 / 15 / 10 / 5 / 0). N/A — чат закончился до того, как клиент сформулировал запрос.",
        "scale_rubric": [
            {"val": 20, "desc": "Все существенные вопросы закрыты или дан корректный следующий шаг."},
            {"val": 15, "desc": "Основной вопрос решён, пропущена второстепенная деталь."},
            {"val": 10, "desc": "Часть запроса закрыта, существенный вопрос остался открытым."},
            {"val": 5, "desc": "Есть общая подсказка, но клиенту всё ещё непонятно, как действовать."},
            {"val": 0, "desc": "Ответа по существу нет или ключевая рекомендация ошибочна."}
        ]
    },
    {
        "id": "empathy",
        "code": "05",
        "name": "Эмпатия и клиентоориентированность",
        "section": "ВЕДЕНИЕ И ЗАВЕРШЕНИЕ ДИАЛОГА",
        "type": "YES_NO",
        "weight": 15,
        "allow_na": False,
        "max_scale": 1,
        "description": "Да — оператор вежлив и, если клиент выразил недовольство или неудобство, отреагировал на конкретную проблему. Нет — сухость, грубость или игнорирование жалобы.",
        "scale_rubric": None
    },
    {
        "id": "dialogue_mgmt",
        "code": "06",
        "name": "Управление диалогом, скорость и грамотность",
        "section": "ВЕДЕНИЕ И ЗАВЕРШЕНИЕ ДИАЛОГА",
        "type": "SCALE",
        "weight": 15,
        "allow_na": False,
        "max_scale": 10,
        "description": "Оцените ясность, порядок ответов и предупреждение об ожидании по шкале (10 / 7 / 4 / 0). Порог 3 минуты, теги и вложения не входят в оценку.",
        "scale_rubric": [
            {"val": 10, "desc": "Ответы ясные и связные. Если было явное ожидание, оператор предупредил."},
            {"val": 7, "desc": "Один заметный сбой, но клиент может понять ответ и продолжить."},
            {"val": 4, "desc": "Клиенту приходится переспрашивать из-за формулировок или порядка ответов."},
            {"val": 0, "desc": "Из-за бессвязных или противоречивых реплик ход диалога непонятен."}
        ]
    },
    {
        "id": "closing",
        "code": "07",
        "name": "Завершение",
        "section": "ВЕДЕНИЕ И ЗАВЕРШЕНИЕ ДИАЛОГА",
        "type": "YES_NO_NA",
        "weight": 5,
        "allow_na": True,
        "max_scale": 1,
        "description": "Да — оператор подвёл итог или предложил дальнейшую помощь и попрощался. Нет — чат закрыт без прощания/итога. N/A — чат оборвался до возможности его завершить.",
        "scale_rubric": None
    },
    {
        "id": "severe_errors",
        "code": "08",
        "name": "Грубые ошибки",
        "section": "ГРУБЫЕ НАРУШЕНИЯ",
        "type": "CRITICAL_FLAG",
        "weight": 0,
        "allow_na": False,
        "max_scale": 1,
        "description": "Да — выявлено оскорбление клиента, предложение платной услуги в обход компании или раскрытие конфиденциальной информации. Нет — нарушений не выявлено.",
        "scale_rubric": None
    }
]

def get_active_checklist() -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM checklists WHERE is_active = 1 LIMIT 1")
    row = cursor.fetchone()
    if not row:
        default_id = "fb_cqa_standard_v1"
        cursor.execute(
            "INSERT INTO checklists (id, name, is_active, criteria_json) VALUES (?, ?, 1, ?)",
            (default_id, "Стандартный чек-лист Freedom Broker (8 критериев)", json.dumps(DEFAULT_CRITERIA, ensure_ascii=False))
        )
        conn.commit()
        cursor.execute("SELECT * FROM checklists WHERE id = ?", (default_id,))
        row = cursor.fetchone()
    conn.close()
    return {
        "id": row["id"],
        "name": row["name"],
        "is_active": bool(row["is_active"]),
        "criteria": json.loads(row["criteria_json"]),
        "updated_at": row["updated_at"]
    }

def update_checklist(checklist_id: str, name: str, criteria: List[Dict[str, Any]]) -> Dict[str, Any]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE checklists SET name = ?, criteria_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (name, json.dumps(criteria, ensure_ascii=False), checklist_id)
    )
    conn.commit()
    conn.close()
    return get_active_checklist()

def determine_criterion_chess_badge(
    crit_id: str,
    status: str,
    raw_score: float,
    max_scale: float,
    is_na: bool,
    detected_violation: bool
) -> str:
    """
    Returns one of the chess rating icon names matching assets/rating icons:
    'brilliant', 'great', 'best', 'Excellent', 'Good', 'Book', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder'
    """
    if detected_violation:
        return "Blunder"
    if is_na or status == "NA":
        return "NA"

    if crit_id == "severe_errors":
        return "Blunder" if (detected_violation or status == "YES") else "Good"

    # Strict status checks: if status is NO, it MUST be a penalizing badge
    if crit_id == "contact":
        return "Book" if status == "YES" else "Miss"
    if crit_id == "need":
        return "best" if status == "YES" else "Inaccuracy"
    if crit_id == "identification":
        return "Book" if status == "YES" else "Blunder"
    if crit_id == "empathy":
        return "Excellent" if status == "YES" else "Mistake"
    if crit_id == "closing":
        return "Book" if status == "YES" else "Miss"

    if crit_id == "consultation":
        if status == "NO" or raw_score <= 0:
            return "Blunder"
        elif raw_score >= 20:
            return "brilliant"
        elif raw_score >= 15:
            return "Good"
        elif raw_score >= 10:
            return "Inaccuracy"
        elif raw_score >= 5:
            return "Mistake"
        else:
            return "Blunder"

    if crit_id == "dialogue_mgmt":
        if status == "NO" or raw_score <= 0:
            return "Blunder"
        elif raw_score >= 10:
            return "best"
        elif raw_score >= 7:
            return "Good"
        elif raw_score >= 4:
            return "Inaccuracy"
        else:
            return "Blunder"

    # Generic fallback based on ratio
    ratio = raw_score / max_scale if max_scale > 0 else 0
    if status == "NO" or ratio <= 0:
        return "Miss"
    if ratio >= 1.0:
        return "best"
    elif ratio >= 0.7:
        return "Good"
    elif ratio >= 0.4:
        return "Inaccuracy"
    return "Mistake"

def determine_overall_chess_badge(total_score: float, severe_violation: bool) -> str:
    """
    Overall dialogue badge based on total score and violations.
    """
    if severe_violation:
        return "Blunder"
    if total_score >= 98.0:
        return "brilliant"
    elif total_score >= 88.0:
        return "great"
    elif total_score >= 78.0:
        return "best"
    elif total_score >= 68.0:
        return "Good"
    elif total_score >= 50.0:
        return "Inaccuracy"
    elif total_score >= 30.0:
        return "Mistake"
    elif total_score > 0.0:
        return "Miss"
    return "Blunder"

def calculate_cqa_scores(raw_evaluations: Dict[str, Any], criteria: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Implements Freedom Broker CQA mathematical scoring with dynamic N/A weight redistribution.
    Rule:
    1. Identify applicable criteria (is_na == False).
    2. Sum applicable base weights: W_applicable = sum(c['weight'] for c in applicable).
    3. Normalization factor: Factor = 100.0 / W_applicable.
    4. For each applicable criterion:
       redistributed_weight = c['weight'] * Factor
       raw_ratio = raw_score / max_scale
       final_score = raw_ratio * redistributed_weight
    5. Total score = sum(final_score), rounded to 2 decimal places. Max strictly 100.00.
    """
    applicable_criteria = []
    na_criteria = []
    severe_violation = False

    for c in criteria:
        cid = c["id"]
        c_eval = raw_evaluations.get(cid, {})
        status = str(c_eval.get("status", "NO")).strip().upper()
        is_na = c_eval.get("is_na", False) or status == "NA"

        # Check for severe error
        if cid == "severe_errors":
            if c_eval.get("detected") is True or status == "YES":
                severe_violation = True
            continue

        if is_na and c.get("allow_na", False):
            na_criteria.append(c)
        else:
            applicable_criteria.append(c)

    total_applicable_weight = sum(c.get("weight", 0) for c in applicable_criteria)
    redistribute_factor = (100.0 / total_applicable_weight) if total_applicable_weight > 0 else 1.0

    criteria_results = {}
    total_calculated_score = 0.0
    section_scores = {}

    for c in criteria:
        cid = c["id"]
        c_eval = raw_evaluations.get(cid, {})
        status = str(c_eval.get("status", "NO")).strip().upper()
        is_na = (c_eval.get("is_na", False) or status == "NA") and c.get("allow_na", False)
        crit_type = c.get("type", "YES_NO")
        max_scale = float(c.get("max_scale", 1.0))
        weight = float(c.get("weight", 0.0))
        section = c.get("section", "ОБЩЕЕ")

        # Rigorous score handling depending on status and type:
        if status == "NO":
            raw_score = 0.0
        elif status == "NA" or is_na:
            raw_score = 0.0
            is_na = True
            status = "NA"
        elif crit_type in ("YES_NO", "YES_NO_NA"):
            raw_score = max_scale if status == "YES" else 0.0
        else:
            # SCALE or SCALE_NA
            try:
                raw_score = float(c_eval.get("raw_score", 0.0))
            except (ValueError, TypeError):
                raw_score = 0.0
            raw_score = min(max(raw_score, 0.0), max_scale)

        if section not in section_scores:
            section_scores[section] = {"earned": 0.0, "max": 0.0}

        detected_violation = False
        if cid == "severe_errors":
            detected_violation = (c_eval.get("detected") is True or status == "YES")
            earned_score = 0.0
            redist_weight = 0.0
        elif is_na:
            earned_score = 0.0
            redist_weight = 0.0
        else:
            # Scaled score with redistribution
            redist_weight = round(weight * redistribute_factor, 4)
            ratio = (raw_score / max_scale) if max_scale > 0 else 0.0
            earned_score = round(ratio * redist_weight, 4)
            total_calculated_score += earned_score
            section_scores[section]["earned"] += earned_score
            section_scores[section]["max"] += redist_weight

        chess_badge = determine_criterion_chess_badge(
            cid, status, raw_score, max_scale, is_na, detected_violation
        )

        criteria_results[cid] = {
            "criterion_id": cid,
            "code": c.get("code", ""),
            "name": c.get("name", ""),
            "section": section,
            "status": status,
            "is_na": is_na,
            "raw_score": raw_score,
            "max_scale": max_scale,
            "base_weight": weight,
            "redistributed_weight": round(redist_weight, 2),
            "final_score": round(earned_score, 2),
            "reasoning": c_eval.get("reasoning", ""),
            "quote": c_eval.get("quote", "") if not is_na else "",
            "quote_timestamp": c_eval.get("quote_timestamp", "") if not is_na else "",
            "chess_badge": chess_badge
        }

    # Format section scores
    for sec in section_scores:
        section_scores[sec]["earned"] = round(section_scores[sec]["earned"], 2)
        section_scores[sec]["max"] = round(section_scores[sec]["max"], 2)

    total_final = min(round(total_calculated_score, 2), 100.0)
    overall_chess_badge = determine_overall_chess_badge(total_final, severe_violation)

    return {
        "total_score": total_final,
        "severe_violation": severe_violation,
        "chess_badge": overall_chess_badge,
        "criteria_results": criteria_results,
        "section_scores": section_scores,
        "redistributed": len(na_criteria) > 0,
        "na_criteria_count": len(na_criteria),
        "applicable_weight_sum": total_applicable_weight
    }
