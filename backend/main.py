"""
main.py — NeuralMigrate backend.

CLI:       python main.py ingest|migrate|serve
Gunicorn:  gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT

Uses Ollama (free/local) by default. Set LLM_PROVIDER=openai for cloud.
"""
from __future__ import annotations
import argparse, json, logging, os, sys, time
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("main")

# ── FastAPI app ───────────────────────────────────────────────────────────────
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="NeuralMigrate API",
    description="Multi-agent LangGraph code migration — C++/Java → Python",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173,http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

# Initialise history DB on startup
from history import init_db, save_run, get_history, get_run, get_metrics, delete_run
from auth import verify_api_key

# ── Concurrency guard ─────────────────────────────────────────────────────────
# Limits concurrent pipeline runs to 1 on free-tier servers (Render free = 512MB RAM).
# Prevents OOM crashes when multiple users hit /migrate simultaneously.
import threading
_PIPELINE_LOCK = threading.Semaphore(2)  # allow max 2 concurrent migrations

@app.on_event("startup")
def startup():
    init_db()
    logger.info("NeuralMigrate API started.")


# ── Pydantic models ───────────────────────────────────────────────────────────
class MigrateRequest(BaseModel):
    source_code: str
    source_language: str = "cpp"
    file_path: str = "api_upload"

class MigrateResponse(BaseModel):
    run_id: int
    status: str
    translated_code: str
    optimized_code: str
    original_complexity: str
    optimized_complexity: str
    confidence_score: float
    validation_outcome: str
    iterations: int
    duration_ms: int
    entities_extracted: int
    vector_results: int
    graph_results: int
    errors: list[str]
    execution_log: list[str]
    explanation: str
    complexity_report: str

class HistoryItem(BaseModel):
    id: int
    created_at: str
    file_path: str
    source_language: str
    status: str
    confidence_score: float
    iterations: int
    original_complexity: str
    optimized_complexity: str
    validation_outcome: str
    source_lines: int
    output_lines: int
    duration_ms: int
    entities_extracted: int
    vector_results: int
    graph_results: int
    error_count: int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/migrate", response_model=MigrateResponse)
def migrate_endpoint(
    req: MigrateRequest,
    _key: str = Depends(verify_api_key),
):
    """Run the full 4-agent LangGraph migration pipeline."""
    if not _PIPELINE_LOCK.acquire(blocking=False):
        raise HTTPException(
            status_code=503,
            detail="Server busy — another migration is running. Please retry in a few seconds.",
        )
    t0 = time.perf_counter()
    try:
        from graph_engine import MigrationGraph, build_embedding_client, build_llm
        from knowledge_base import KnowledgeBase

        provider = os.getenv("LLM_PROVIDER", "ollama")
        kb = KnowledgeBase()
        kb.bootstrap()
        graph = MigrationGraph(
            kb=kb,
            llm=build_llm(provider=provider),
            embedding_client=build_embedding_client(provider=provider),
            max_iterations=int(os.getenv("MAX_ITERATIONS", "3")),
        )
        state = graph.run(req.source_code, req.source_language, req.file_path)
        kb.close()
    except Exception as exc:
        logger.error("Pipeline error: %s", exc)
        _PIPELINE_LOCK.release()
        raise HTTPException(status_code=500, detail=str(exc))

    duration_ms = int((time.perf_counter() - t0) * 1000)
    opt   = state.get("optimization_result", {})
    trans = state.get("translation_result", {})
    val   = state.get("validation_result", {})
    ctx   = state.get("retrieved_context", {})

    src_lines = req.source_code.count("\n") + 1
    out_code  = opt.get("optimized_code", trans.get("translated_code", ""))
    out_lines = out_code.count("\n") + 1 if out_code else 0
    conf      = float(trans.get("confidence_score", 0.0))
    iters     = int(state.get("iteration", 1))
    n_ent     = len(state.get("parsed_entities", []))
    n_vec     = len(ctx.get("vector_results", []))
    n_graph   = len(ctx.get("graph_results", []))

    run_id = save_run(
        file_path=req.file_path,
        source_language=req.source_language,
        status=state.get("status", "unknown"),
        confidence_score=conf,
        iterations=iters,
        original_complexity=opt.get("original_complexity", ""),
        optimized_complexity=opt.get("optimized_complexity", ""),
        validation_outcome=val.get("outcome", ""),
        source_lines=src_lines,
        output_lines=out_lines,
        duration_ms=duration_ms,
        entities_extracted=n_ent,
        vector_results=n_vec,
        graph_results=n_graph,
        error_count=len(state.get("errors", [])),
        source_code=req.source_code,
        output_code=out_code,
        explanation=trans.get("explanation", ""),
        complexity_report=opt.get("optimization_notes", ""),
    )

    _PIPELINE_LOCK.release()
    return MigrateResponse(
        run_id=run_id,
        status=state.get("status", "unknown"),
        translated_code=trans.get("translated_code", ""),
        optimized_code=out_code,
        original_complexity=opt.get("original_complexity", "N/A"),
        optimized_complexity=opt.get("optimized_complexity", "N/A"),
        confidence_score=conf,
        validation_outcome=val.get("outcome", "unknown"),
        iterations=iters,
        duration_ms=duration_ms,
        entities_extracted=n_ent,
        vector_results=n_vec,
        graph_results=n_graph,
        errors=state.get("errors", []),
        execution_log=state.get("execution_log", []),
        explanation=trans.get("explanation", ""),
        complexity_report=opt.get("optimization_notes", ""),
    )


@app.get("/history", response_model=list[HistoryItem])
def history_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _key: str = Depends(verify_api_key),
):
    """Return paginated migration history."""
    return get_history(limit=limit, offset=offset)


@app.get("/history/{run_id}")
def history_detail(run_id: int, _key: str = Depends(verify_api_key)):
    """Return full detail of one run including source/output code."""
    row = get_run(run_id)
    if not row:
        raise HTTPException(status_code=404, detail="Run not found")
    return row


@app.delete("/history/{run_id}")
def delete_history(run_id: int, _key: str = Depends(verify_api_key)):
    if not delete_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    return {"deleted": run_id}


@app.get("/metrics")
def metrics_endpoint(_key: str = Depends(verify_api_key)):
    """Aggregate metrics across all recorded migrations."""
    return get_metrics()


@app.get("/benchmark")
def benchmark_results():
    """Return pre-computed benchmark evaluation results (no auth needed — public)."""
    results_path = Path(__file__).parent / "evaluation" / "results.json"
    if not results_path.exists():
        raise HTTPException(status_code=404, detail="No benchmark results yet. Run: python -m evaluation.benchmark")
    return json.loads(results_path.read_text())


# ── CLI helpers ───────────────────────────────────────────────────────────────

def _detect_language(fp: str):
    from schema import SourceLanguage
    ext = Path(fp).suffix.lower()
    if ext in {".cpp",".cc",".cxx",".h",".hpp"}: return SourceLanguage.CPP
    if ext == ".java": return SourceLanguage.JAVA
    raise ValueError(f"Unsupported extension: {ext}")


def _build_stack(provider: str = "ollama"):
    from graph_engine import MigrationGraph, build_embedding_client, build_llm
    from knowledge_base import KnowledgeBase
    kb = KnowledgeBase(); kb.bootstrap()
    graph = MigrationGraph(
        kb=kb,
        llm=build_llm(provider),
        embedding_client=build_embedding_client(provider),
        max_iterations=int(os.getenv("MAX_ITERATIONS", "3")),
    )
    return kb, graph


def cmd_ingest(args):
    from knowledge_base import KnowledgeBase, get_embeddings_batch
    from parsers import parse_folder
    from graph_engine import build_embedding_client
    if not Path(args.folder).exists():
        logger.error("Folder not found: %s", args.folder); sys.exit(1)
    logger.info("=== INGEST  folder=%s  provider=%s ===", args.folder, args.provider)
    entities = parse_folder(args.folder)
    if not entities: logger.warning("No entities found."); return
    embed = build_embedding_client(provider=args.provider)
    texts = [f"{e.entity_type} {e.name} in {e.language.value}:\n{e.source_code[:800]}" for e in entities]
    embeddings = get_embeddings_batch(texts, embed, batch_size=32)
    kb = KnowledgeBase(); kb.bootstrap()
    kb.ingest_entities(entities, embeddings); kb.close()
    logger.info("=== INGEST COMPLETE: %d entities ===", len(entities))


def cmd_migrate(args):
    init_db()
    if not Path(args.file).exists():
        logger.error("Not found: %s", args.file); sys.exit(1)
    src  = Path(args.file).read_text(encoding="utf-8", errors="replace")
    lang = _detect_language(args.file)
    kb, graph = _build_stack(args.provider)
    t0 = time.perf_counter()
    try:
        if args.stream:
            state = None
            for node, delta in graph.stream(src, lang.value, args.file):
                logger.info("  ✓ %-24s status=%s", node, delta.get("status",""))
                state = delta
        else:
            state = graph.run(src, lang.value, args.file)
        duration_ms = int((time.perf_counter()-t0)*1000)
        opt   = state.get("optimization_result", {})
        trans = state.get("translation_result", {})
        code  = opt.get("optimized_code") or trans.get("translated_code") or "# No code"
        print(f"\nStatus     : {state.get('status')}")
        print(f"Confidence : {trans.get('confidence_score',0):.0%}")
        print(f"Complexity : {opt.get('original_complexity','?')} → {opt.get('optimized_complexity','?')}")
        print(f"Duration   : {duration_ms}ms\n")
        print(code)
        if args.output:
            Path(args.output).write_text(code); logger.info("Written → %s", args.output)
        save_run(file_path=args.file, source_language=lang.value, status=state.get("status",""),
                 confidence_score=float(trans.get("confidence_score",0)),
                 original_complexity=opt.get("original_complexity",""),
                 optimized_complexity=opt.get("optimized_complexity",""),
                 validation_outcome=state.get("validation_result",{}).get("outcome",""),
                 duration_ms=duration_ms, source_code=src, output_code=code)
    finally:
        kb.close()


def cmd_serve(args):
    import uvicorn
    uvicorn.run("main:app", host=os.getenv("HOST","0.0.0.0"), port=args.port, reload=args.reload)


def main():
    parser = argparse.ArgumentParser(prog="neuralmigrate")
    sub = parser.add_subparsers(dest="command", required=True)

    pi = sub.add_parser("ingest")
    pi.add_argument("--folder", required=True)
    pi.add_argument("--provider", default=os.getenv("LLM_PROVIDER","ollama"), choices=["openai","ollama","deepseek"])

    pm = sub.add_parser("migrate")
    pm.add_argument("--file", required=True)
    pm.add_argument("--provider", default=os.getenv("LLM_PROVIDER","ollama"), choices=["openai","ollama","deepseek"])
    pm.add_argument("--output", default=None)
    pm.add_argument("--stream", action="store_true")

    ps = sub.add_parser("serve")
    ps.add_argument("--port", type=int, default=int(os.getenv("PORT","8080")))
    ps.add_argument("--provider", default=os.getenv("LLM_PROVIDER","ollama"))
    ps.add_argument("--reload", action="store_true")

    args = parser.parse_args()
    {"ingest": cmd_ingest, "migrate": cmd_migrate, "serve": cmd_serve}[args.command](args)


if __name__ == "__main__":
    main()
