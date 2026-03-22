"""
history.py  —  SQLite migration history store.
Zero external dependencies. Works on free Render / Railway tiers.
Uses a persistent module-level connection for :memory: (test mode),
and per-call connections for file-backed databases (production).
"""
from __future__ import annotations

import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("HISTORY_DB", str(Path(__file__).parent / "migration_history.db"))

# Persistent connection used only when DB_PATH == ":memory:" (test isolation)
_MEMORY_CONN: Optional[sqlite3.Connection] = None


def _conn() -> sqlite3.Connection:
    """Return a SQLite connection.

    For :memory: databases a single persistent connection is reused so that
    all callers share the same in-process database.  For file-backed databases
    a fresh connection is opened per call (thread-safe with check_same_thread).
    """
    global _MEMORY_CONN
    if DB_PATH == ":memory:":
        if _MEMORY_CONN is None:
            _MEMORY_CONN = sqlite3.connect(":memory:", check_same_thread=False)
            _MEMORY_CONN.row_factory = sqlite3.Row
        return _MEMORY_CONN

    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def _reset_memory_conn() -> None:
    """Reset the in-memory singleton — call from tests before each session."""
    global _MEMORY_CONN
    _MEMORY_CONN = None


def init_db() -> None:
    """Create tables and indexes — idempotent."""
    conn = _conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS migrations (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at           TEXT    NOT NULL,
            file_path            TEXT    NOT NULL,
            source_language      TEXT    NOT NULL,
            status               TEXT    NOT NULL,
            confidence_score     REAL    DEFAULT 0.0,
            iterations           INTEGER DEFAULT 1,
            original_complexity  TEXT    DEFAULT '',
            optimized_complexity TEXT    DEFAULT '',
            validation_outcome   TEXT    DEFAULT '',
            source_lines         INTEGER DEFAULT 0,
            output_lines         INTEGER DEFAULT 0,
            duration_ms          INTEGER DEFAULT 0,
            entities_extracted   INTEGER DEFAULT 0,
            vector_results       INTEGER DEFAULT 0,
            graph_results        INTEGER DEFAULT 0,
            error_count          INTEGER DEFAULT 0,
            source_code          TEXT    DEFAULT '',
            output_code          TEXT    DEFAULT '',
            explanation          TEXT    DEFAULT '',
            complexity_report    TEXT    DEFAULT ''
        )
    """)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_created ON migrations(created_at DESC)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_lang    ON migrations(source_language)"
    )
    conn.commit()
    logger.info("History DB ready at %s", DB_PATH)


def save_run(
    *,
    file_path: str,
    source_language: str,
    status: str,
    confidence_score: float = 0.0,
    iterations: int = 1,
    original_complexity: str = "",
    optimized_complexity: str = "",
    validation_outcome: str = "",
    source_lines: int = 0,
    output_lines: int = 0,
    duration_ms: int = 0,
    entities_extracted: int = 0,
    vector_results: int = 0,
    graph_results: int = 0,
    error_count: int = 0,
    source_code: str = "",
    output_code: str = "",
    explanation: str = "",
    complexity_report: str = "",
) -> int:
    """Insert one migration run and return its auto-generated id."""
    conn = _conn()
    cur = conn.execute(
        """
        INSERT INTO migrations (
            created_at, file_path, source_language, status,
            confidence_score, iterations,
            original_complexity, optimized_complexity,
            validation_outcome, source_lines, output_lines, duration_ms,
            entities_extracted, vector_results, graph_results, error_count,
            source_code, output_code, explanation, complexity_report
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            datetime.now(timezone.utc).isoformat(),
            file_path, source_language, status,
            round(confidence_score, 4), iterations,
            original_complexity, optimized_complexity,
            validation_outcome, source_lines, output_lines, duration_ms,
            entities_extracted, vector_results, graph_results, error_count,
            source_code[:8000], output_code[:8000],
            explanation[:4000], complexity_report[:4000],
        ),
    )
    conn.commit()
    return cur.lastrowid


def get_history(limit: int = 50, offset: int = 0) -> list[dict]:
    """Return recent migrations ordered newest-first."""
    conn = _conn()
    rows = conn.execute(
        """
        SELECT id, created_at, file_path, source_language, status,
               confidence_score, iterations, original_complexity,
               optimized_complexity, validation_outcome,
               source_lines, output_lines, duration_ms,
               entities_extracted, vector_results, graph_results, error_count
        FROM migrations
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    ).fetchall()
    return [dict(r) for r in rows]


def get_run(run_id: int) -> Optional[dict]:
    """Return full detail of one run (including source/output code)."""
    conn = _conn()
    row = conn.execute(
        "SELECT * FROM migrations WHERE id = ?", (run_id,)
    ).fetchone()
    return dict(row) if row else None


def get_metrics() -> dict:
    """Aggregate metrics across all recorded runs."""
    conn = _conn()
    total = conn.execute("SELECT COUNT(*) FROM migrations").fetchone()[0]
    if total == 0:
        return _empty_metrics()

    r = conn.execute(
        """
        SELECT
            COUNT(*)                                                AS total,
            SUM(CASE WHEN status='validated' THEN 1 ELSE 0 END)    AS passed,
            SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END)     AS failed,
            ROUND(AVG(confidence_score)*100, 1)                     AS avg_conf,
            ROUND(AVG(duration_ms), 0)                              AS avg_ms,
            ROUND(AVG(iterations), 2)                               AS avg_iter,
            SUM(source_lines)                                       AS src_lines,
            SUM(output_lines)                                       AS out_lines,
            MAX(confidence_score)*100                               AS max_conf,
            MIN(confidence_score)*100                               AS min_conf,
            SUM(entities_extracted)                                 AS tot_ent,
            SUM(CASE WHEN validation_outcome='pass'
                      AND iterations=1 THEN 1 ELSE 0 END)           AS first_pass,
            SUM(CASE WHEN iterations>1 THEN 1 ELSE 0 END)           AS retried
        FROM migrations
        """
    ).fetchone()

    improved = conn.execute(
        """
        SELECT COUNT(*) FROM migrations
        WHERE original_complexity != optimized_complexity
          AND original_complexity != ''
          AND optimized_complexity != ''
        """
    ).fetchone()[0]

    by_lang = [
        dict(x)
        for x in conn.execute(
            """
            SELECT source_language,
                   COUNT(*) AS count,
                   ROUND(AVG(confidence_score)*100, 1) AS avg_conf,
                   SUM(CASE WHEN status='validated' THEN 1 ELSE 0 END) AS passed
            FROM migrations
            GROUP BY source_language
            """
        ).fetchall()
    ]

    trend = [
        dict(x)
        for x in conn.execute(
            """
            SELECT DATE(created_at) AS day,
                   COUNT(*) AS runs,
                   ROUND(AVG(confidence_score)*100, 1) AS avg_conf,
                   SUM(CASE WHEN status='validated' THEN 1 ELSE 0 END) AS passed
            FROM migrations
            WHERE created_at >= DATE('now', '-30 days')
            GROUP BY day
            ORDER BY day
            """
        ).fetchall()
    ]

    passed = int(r["passed"] or 0)
    first  = int(r["first_pass"] or 0)
    return {
        "total_runs":                  int(total),
        "passed":                      passed,
        "failed":                      int(r["failed"] or 0),
        "pass_rate_pct":               round(passed / max(total, 1) * 100, 1),
        "first_pass_rate_pct":         round(first / max(passed, 1) * 100, 1),
        "avg_confidence_pct":          float(r["avg_conf"] or 0),
        "max_confidence_pct":          round(float(r["max_conf"] or 0), 1),
        "min_confidence_pct":          round(float(r["min_conf"] or 0), 1),
        "avg_duration_ms":             int(r["avg_ms"] or 0),
        "avg_iterations":              float(r["avg_iter"] or 1),
        "total_source_lines":          int(r["src_lines"] or 0),
        "total_output_lines":          int(r["out_lines"] or 0),
        "complexity_improved":         int(improved),
        "complexity_improve_rate_pct": round(improved / max(total, 1) * 100, 1),
        "total_entities_extracted":    int(r["tot_ent"] or 0),
        "needed_retry":                int(r["retried"] or 0),
        "by_language":                 by_lang,
        "trend_7d":                    trend,
    }


def delete_run(run_id: int) -> bool:
    """Delete one run. Returns True if a row was removed."""
    conn = _conn()
    cur  = conn.execute("DELETE FROM migrations WHERE id = ?", (run_id,))
    conn.commit()
    return cur.rowcount > 0


def _empty_metrics() -> dict:
    return {
        "total_runs": 0, "passed": 0, "failed": 0,
        "pass_rate_pct": 0.0, "first_pass_rate_pct": 0.0,
        "avg_confidence_pct": 0.0, "max_confidence_pct": 0.0,
        "min_confidence_pct": 0.0, "avg_duration_ms": 0,
        "avg_iterations": 1.0, "total_source_lines": 0,
        "total_output_lines": 0, "complexity_improved": 0,
        "complexity_improve_rate_pct": 0.0,
        "total_entities_extracted": 0, "needed_retry": 0,
        "by_language": [], "trend_7d": [],
    }
