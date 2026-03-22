"""
tests/test_schema.py — Pydantic schema validation tests.
Run:  pytest tests/test_schema.py -v
"""
import json
import pytest
from schema import (
    ASTNode, CodeEntity, MigrationStatus, OptimizationResult,
    RetrievedContext, SourceLanguage, TranslationResult,
    ValidationOutcome, ValidationResult,
)


def _entity(**kw):
    defaults = dict(
        entity_id="abc12345678901234"[:16],
        name="test_func",
        entity_type="function",
        language=SourceLanguage.CPP,
        file_path="test.cpp",
        source_code="int f() { return 0; }",
    )
    return CodeEntity(**{**defaults, **kw})


# ── CodeEntity ────────────────────────────────────────────────────────────────

def test_entity_creation_minimal():
    e = _entity()
    assert e.name == "test_func"
    assert e.language == SourceLanguage.CPP


def test_entity_defaults():
    e = _entity()
    assert e.dependencies == []
    assert e.ast_nodes == []
    assert e.docstring is None
    assert e.complexity_label is None


def test_entity_java_language():
    e = _entity(language=SourceLanguage.JAVA, file_path="Test.java")
    assert e.language == SourceLanguage.JAVA


def test_entity_model_dump():
    e = _entity()
    d = e.model_dump()
    assert d["language"] == "cpp"
    assert isinstance(d["dependencies"], list)
    assert isinstance(d["ast_nodes"], list)


def test_entity_json_serialisable():
    e = _entity()
    # Should not raise
    raw = json.dumps(e.model_dump())
    assert "test_func" in raw


def test_entity_types():
    for et in ("function", "class", "module", "external"):
        e = _entity(entity_type=et)
        assert e.entity_type == et


# ── TranslationResult ─────────────────────────────────────────────────────────

def test_translation_result_defaults():
    r = TranslationResult()
    assert r.confidence_score == 0.0
    assert r.retry_count == 0
    assert r.translated_code == ""


def test_translation_result_valid():
    r = TranslationResult(translated_code="def f(): pass", confidence_score=0.9)
    assert r.confidence_score == pytest.approx(0.9)


def test_translation_result_confidence_bounds_low():
    with pytest.raises(Exception):
        TranslationResult(confidence_score=-0.1)


def test_translation_result_confidence_bounds_high():
    with pytest.raises(Exception):
        TranslationResult(confidence_score=1.5)


def test_translation_result_confidence_edge():
    r0 = TranslationResult(confidence_score=0.0)
    r1 = TranslationResult(confidence_score=1.0)
    assert r0.confidence_score == 0.0
    assert r1.confidence_score == 1.0


# ── ValidationResult ──────────────────────────────────────────────────────────

def test_validation_result_defaults():
    r = ValidationResult()
    assert r.outcome == ValidationOutcome.SKIP
    assert r.errors == []
    assert r.suggestions == []
    assert r.test_output == ""


def test_validation_outcome_pass():
    r = ValidationResult(outcome=ValidationOutcome.PASS)
    assert r.outcome == ValidationOutcome.PASS


def test_validation_outcome_fail():
    r = ValidationResult(outcome=ValidationOutcome.FAIL, errors=["SyntaxError"])
    assert len(r.errors) == 1


# ── OptimizationResult ────────────────────────────────────────────────────────

def test_optimization_result_defaults():
    r = OptimizationResult()
    assert r.optimized_code == ""
    assert r.original_complexity == ""
    assert r.optimized_complexity == ""


def test_optimization_result_full():
    r = OptimizationResult(
        optimized_code="def f(): pass",
        original_complexity="O(n²)",
        optimized_complexity="O(n log n)",
        optimization_notes="Used bisect.",
    )
    assert r.original_complexity == "O(n²)"
    assert r.optimized_complexity == "O(n log n)"


# ── RetrievedContext ──────────────────────────────────────────────────────────

def test_retrieved_context_defaults():
    c = RetrievedContext()
    assert c.vector_results == []
    assert c.graph_results == []
    assert c.combined_summary == ""


def test_retrieved_context_with_data():
    c = RetrievedContext(
        vector_results=[{"name": "bubbleSort", "score": 0.93}],
        graph_results=[{"name": "swap"}],
    )
    assert len(c.vector_results) == 1
    assert len(c.graph_results) == 1


# ── Enumerations ─────────────────────────────────────────────────────────────

def test_migration_status_values():
    assert MigrationStatus.PENDING.value   == "pending"
    assert MigrationStatus.VALIDATED.value == "validated"
    assert MigrationStatus.FAILED.value    == "failed"
    assert MigrationStatus.TRANSLATED.value == "translated"
    assert MigrationStatus.OPTIMIZED.value  == "optimized"


def test_source_language_values():
    assert SourceLanguage.CPP.value  == "cpp"
    assert SourceLanguage.JAVA.value == "java"


def test_validation_outcome_values():
    assert ValidationOutcome.PASS.value == "pass"
    assert ValidationOutcome.FAIL.value == "fail"
    assert ValidationOutcome.SKIP.value == "skip"


# ── ASTNode ───────────────────────────────────────────────────────────────────

def test_ast_node_creation():
    n = ASTNode(node_type="function_definition", start_line=1, end_line=10)
    assert n.node_type == "function_definition"
    assert n.children == []


def test_ast_node_with_name():
    n = ASTNode(node_type="class_declaration", name="Sorter", start_line=1, end_line=30)
    assert n.name == "Sorter"


# ── history.py unit tests ────────────────────────────────────────────────────

def test_history_save_and_retrieve(tmp_path, monkeypatch):
    import history
    monkeypatch.setattr(history, "DB_PATH", str(tmp_path / "test.db"))
    history.init_db()

    rid = history.save_run(
        file_path="test.cpp",
        source_language="cpp",
        status="validated",
        confidence_score=0.92,
        iterations=1,
        original_complexity="O(n²)",
        optimized_complexity="O(n log n)",
    )
    assert isinstance(rid, int)
    assert rid > 0

    row = history.get_run(rid)
    assert row is not None
    assert row["status"] == "validated"
    assert abs(row["confidence_score"] - 0.92) < 0.001


def test_history_metrics(tmp_path, monkeypatch):
    import history
    monkeypatch.setattr(history, "DB_PATH", str(tmp_path / "metrics.db"))
    history.init_db()

    for i in range(5):
        history.save_run(
            file_path=f"f{i}.cpp", source_language="cpp",
            status="validated" if i < 4 else "failed",
            confidence_score=0.8 + i * 0.02, iterations=1,
        )

    m = history.get_metrics()
    assert m["total_runs"] == 5
    assert m["passed"] == 4
    assert m["failed"] == 1
    assert m["pass_rate_pct"] == pytest.approx(80.0)


def test_history_delete(tmp_path, monkeypatch):
    import history
    monkeypatch.setattr(history, "DB_PATH", str(tmp_path / "del.db"))
    history.init_db()
    rid = history.save_run(file_path="x.cpp", source_language="cpp", status="failed")
    assert history.delete_run(rid) is True
    assert history.get_run(rid) is None
    assert history.delete_run(rid) is False   # already gone
