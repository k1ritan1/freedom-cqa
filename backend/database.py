import sqlite3
import json
from datetime import datetime
from backend.config import DATABASE_PATH

def get_db():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db()
    cursor = conn.cursor()

    # Dialogues table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dialogues (
        conversation_id TEXT PRIMARY KEY,
        dataset_group_id TEXT,
        channel TEXT,
        language TEXT,
        transcript_json TEXT,
        audio_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Checklists table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS checklists (
        id TEXT PRIMARY KEY,
        name TEXT,
        is_active INTEGER DEFAULT 1,
        criteria_json TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Evaluations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evaluations (
        id TEXT PRIMARY KEY,
        conversation_id TEXT UNIQUE,
        checklist_id TEXT,
        status TEXT DEFAULT 'pending',
        total_score REAL DEFAULT 0.0,
        severe_violation INTEGER DEFAULT 0,
        chess_badge TEXT DEFAULT 'Book',
        criteria_results_json TEXT,
        section_scores_json TEXT,
        summary_feedback TEXT,
        model_used TEXT,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0.0,
        latency_ms INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES dialogues(conversation_id)
    )
    """)

    # Appeals table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS appeals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        evaluation_id TEXT,
        criterion_id TEXT,
        original_score REAL,
        proposed_score REAL,
        operator_comment TEXT,
        status TEXT DEFAULT 'pending',
        supervisor_comment TEXT,
        resolved_score REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
    )
    """)

    # Audit Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        action TEXT,
        details_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()
