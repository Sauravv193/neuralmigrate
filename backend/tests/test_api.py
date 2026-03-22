"""
tests/test_api.py — FastAPI endpoint integration tests.
Run:  pytest tests/test_api.py -v          (standalone — recommended)
      pytest tests/ -v -k "not test_api"   (alongside other tests)

All external dependencies (LLM, Neo4j, pgvector) are mocked so no
GPU or cloud credentials are required. SQLite uses :memory: for isolation.
"""
import os
import sys
import pytest
from unittest.mock import MagicMock

os.environ.setdefault("HISTORY_DB",      ":memory:")
os.environ.setdefault("API_KEY",         "")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")
os.environ.setdefault("LLM_PROVIDER",    "ollama")

# Modules to stub — injected at fixture scope so they don't leak
_STUBS = [
    "langchain", "langchain.schema", "langchain_core",
    "langchain_core.language_models", "langchain_core.messages",
    "langchain_community", "langchain_community.chat_models",
    "langchain_groq", "langchain_openai",
    "langgraph", "langgraph.graph",
    "neo4j", "neo4j.exceptions",
    "psycopg2", "psycopg2.extras", "psycopg2.extensions",
    "pgvector", "graph_engine", "knowledge_base",
]


@pytest.fixture(scope="module")
def client():
    """TestClient backed by in-memory SQLite and all heavy deps mocked."""
    saved = {}
    for mod in _STUBS:
        saved[mod] = sys.modules.get(mod)
        if mod not in sys.modules:
            sys.modules[mod] = MagicMock()

    import history
    history.DB_PATH = ":memory:"
    history._reset_memory_conn()
    history.init_db()

    from main import app
    from fastapi.testclient import TestClient
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    # Restore sys.modules
    for mod, orig in saved.items():
        if orig is None:
            sys.modules.pop(mod, None)
        else:
            sys.modules[mod] = orig


def _run_mock_migrate(client, state, *, lang="cpp", code="int x=1;"):
    """Run /migrate with a fully mocked pipeline graph."""
    mock_graph = MagicMock()
    mock_graph.run.return_value = state
    mock_kb = MagicMock()
    mock_kb.bootstrap.return_value = None
    mock_kb.close.return_value     = None
    sys.modules["graph_engine"].MigrationGraph         = MagicMock(return_value=mock_graph)
    sys.modules["graph_engine"].build_llm              = MagicMock(return_value=MagicMock())
    sys.modules["graph_engine"].build_embedding_client = MagicMock(return_value=MagicMock())
    sys.modules["knowledge_base"].KnowledgeBase        = MagicMock(return_value=mock_kb)
    return client.post("/migrate", json={"source_code": code,
                                         "source_language": lang,
                                         "file_path": f"test.{lang}"})


def _make_state(conf=0.95, status="validated", iters=1, before="O(1)", after="O(1)"):
    return {
        "status": status, "iteration": iters,
        "parsed_entities": [{"name":"fn","entity_type":"function","language":"cpp","source_code":""}],
        "retrieved_context": {"vector_results":[{"name":"x","score":0.9}],"graph_results":[{"name":"y"}]},
        "translation_result": {"translated_code":"def fn(a:int)->int:\n    return a",
                                "explanation":"Direct.", "confidence_score": conf},
        "optimization_result": {"optimized_code":"def fn(a:int)->int:\n    return a",
                                 "original_complexity": before, "optimized_complexity": after,
                                 "optimization_notes":"Already optimal."},
        "validation_result": {"outcome":"pass" if status=="validated" else "fail",
                               "errors":[], "test_output":""},
        "errors": [], "execution_log": ["done"],
    }


# ── Health ────────────────────────────────────────────────────────────────────
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert "version" in r.json()

# ── Metrics ───────────────────────────────────────────────────────────────────
def test_metrics_structure(client):
    r = client.get("/metrics")
    assert r.status_code == 200
    for k in ["total_runs","passed","failed","pass_rate_pct","avg_confidence_pct","by_language"]:
        assert k in r.json()

def test_metrics_empty_zeros(client):
    assert client.get("/metrics").json()["total_runs"] == 0

# ── History ───────────────────────────────────────────────────────────────────
def test_history_empty(client):
    r = client.get("/history")
    assert r.status_code == 200
    assert r.json() == []

def test_history_pagination(client):
    assert client.get("/history?limit=5&offset=0").status_code == 200

def test_history_invalid_limit(client):
    assert client.get("/history?limit=0").status_code == 422

def test_history_large_offset(client):
    r = client.get("/history?limit=10&offset=99999")
    assert r.status_code == 200
    assert r.json() == []

def test_history_detail_not_found(client):
    assert client.get("/history/999999").status_code == 404

def test_history_delete_not_found(client):
    assert client.delete("/history/999999").status_code == 404

# ── Benchmark ─────────────────────────────────────────────────────────────────
def test_benchmark(client):
    from pathlib import Path
    if not (Path(__file__).parent.parent / "evaluation" / "results.json").exists():
        pytest.skip("run benchmark first")
    r = client.get("/benchmark")
    assert r.status_code == 200
    d = r.json()
    assert d["total"] > 0
    assert len(d["cases"]) == d["total"]

# ── Migrate — schema ──────────────────────────────────────────────────────────
def test_migrate_empty_rejected(client):
    assert client.post("/migrate", json={}).status_code == 422

def test_migrate_missing_source_rejected(client):
    assert client.post("/migrate", json={"source_language":"cpp"}).status_code == 422

# ── Migrate — pipeline mock ───────────────────────────────────────────────────
def test_migrate_cpp_success(client):
    r = _run_mock_migrate(client, _make_state(conf=0.96), lang="cpp",
                          code="int add(int a,int b){return a+b;}")
    assert r.status_code == 200
    d = r.json()
    assert d["status"]             == "validated"
    assert d["validation_outcome"] == "pass"
    assert abs(d["confidence_score"] - 0.96) < 0.01
    assert d["original_complexity"]  == "O(1)"
    assert d["optimized_complexity"] == "O(1)"
    assert "def fn" in d["optimized_code"]
    assert isinstance(d["run_id"], int) and d["run_id"] > 0
    assert d["iterations"]  == 1
    assert d["duration_ms"] >= 0
    assert isinstance(d["execution_log"], list)
    assert d["entities_extracted"] == 1
    assert d["vector_results"]     == 1
    assert d["graph_results"]      == 1

def test_migrate_java_complexity_improvement(client):
    state = _make_state(conf=0.91, before="O(2^n)", after="O(n)")
    state["optimization_result"]["optimized_code"] = (
        "from functools import lru_cache\nclass Fib:\n"
        "    @lru_cache(maxsize=None)\n    def compute(self,n:int)->int:\n"
        "        return n if n<2 else self.compute(n-1)+self.compute(n-2)\n"
    )
    r = _run_mock_migrate(client, state, lang="java")
    assert r.status_code == 200
    assert r.json()["original_complexity"]  == "O(2^n)"
    assert r.json()["optimized_complexity"] == "O(n)"

def test_migrate_multi_iteration(client):
    r = _run_mock_migrate(client, _make_state(conf=0.82, iters=2))
    assert r.status_code == 200
    assert r.json()["iterations"] == 2

def test_migrate_failed_status(client):
    r = _run_mock_migrate(client, _make_state(conf=0.6, status="failed"))
    assert r.status_code == 200
    assert r.json()["status"]             == "failed"
    assert r.json()["validation_outcome"] == "fail"

def test_migrate_saved_to_history(client):
    r = _run_mock_migrate(client, _make_state(conf=0.88))
    assert r.status_code == 200
    run_id = r.json()["run_id"]
    hist   = client.get("/history?limit=100").json()
    assert run_id in [row["id"] for row in hist]

def test_migrate_detail_retrievable(client):
    r      = _run_mock_migrate(client, _make_state(conf=0.85))
    run_id = r.json()["run_id"]
    d      = client.get(f"/history/{run_id}").json()
    assert d["id"]     == run_id
    assert d["status"] == "validated"
    assert "source_code" in d

def test_migrate_deleteable(client):
    r      = _run_mock_migrate(client, _make_state(conf=0.80))
    run_id = r.json()["run_id"]
    assert client.delete(f"/history/{run_id}").status_code == 200
    assert client.get(f"/history/{run_id}").status_code    == 404

def test_metrics_after_migrations(client):
    r = client.get("/metrics")
    assert r.status_code == 200
    d = r.json()
    assert d["total_runs"] >= 1
    assert 0.0 <= d["pass_rate_pct"]      <= 100.0
    assert 0.0 <= d["avg_confidence_pct"] <= 100.0
