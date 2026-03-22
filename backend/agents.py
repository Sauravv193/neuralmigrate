"""
agents.py
Individual agent node implementations for the LangGraph workflow:

  • ContextAgent      – Parses source, runs hybrid retrieval, summarises context.
  • TranslationAgent  – Translates C++/Java → Python using retrieved context.
  • OptimizationAgent – Analyses complexity and refactors for efficiency.
  • ValidationAgent   – Runs generated code in a sandboxed subprocess, routes
                        feedback back to TranslationAgent on failure.

Each agent is a pure function (AgentState → AgentState) compatible with
LangGraph's `add_node` API.
"""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import textwrap
import time
from typing import Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.language_models import BaseChatModel

from knowledge_base import KnowledgeBase, get_embedding
from parsers import parse_source_file
from schema import (
    AgentState,
    CodeEntity,
    MigrationStatus,
    OptimizationResult,
    RetrievedContext,
    SourceLanguage,
    TranslationResult,
    ValidationOutcome,
    ValidationResult,
)

logger = logging.getLogger(__name__)

# Maximum characters of source code included in LLM prompts
_MAX_CODE_CHARS = 6000
# Default subprocess timeout in seconds
_SUBPROCESS_TIMEOUT = 15


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _invoke_llm(
    llm: BaseChatModel,
    messages: list,
    max_retries: int = 3,
    timeout: float = 60.0,
) -> str:
    """
    Invoke a LangChain chat model with exponential back-off.
    Returns the text content of the first response message, or raises
    RuntimeError after all retries are exhausted.
    """
    for attempt in range(max_retries):
        try:
            response = llm.invoke(messages, timeout=timeout)
            return response.content.strip()
        except Exception as exc:
            wait = 2 ** attempt
            logger.warning(
                "LLM invocation failed (attempt %d/%d): %s – retrying in %ds",
                attempt + 1, max_retries, exc, wait,
            )
            time.sleep(wait)
    raise RuntimeError(f"LLM failed after {max_retries} attempts.")


def _parse_json_block(text: str) -> dict[str, Any]:
    """
    Extract and parse the first JSON object from *text*.
    Handles markdown code fences and control characters in LLM output.

    Three-stage parser:
      1. Direct json.loads — fastest, works most of the time.
      2. Fix bare control characters — LLMs embed real newlines in JSON strings.
      3. Regex fallback — extracts translated_code directly as last resort.
    """
    # Strip ```json ... ``` fences
    cleaned = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()

    # Find first { … }
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in LLM response:\n{text[:500]}")

    raw = match.group(0)

    # Stage 1 — direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Stage 2 — fix unescaped control characters inside JSON string values.
    # LLMs like llama-3.3-70b often embed real newlines/tabs inside JSON strings
    # instead of the escaped sequences \n \t, which is invalid JSON.
    def _fix_string_controls(m: re.Match) -> str:
        inner = m.group(1)
        inner = inner.replace("\\", "\\\\")   # escape existing backslashes first
        inner = inner.replace('"', '\\"')      # re-escape any bare quotes
        inner = inner.replace("\n", "\\n")
        inner = inner.replace("\r", "\\r")
        inner = inner.replace("\t", "\\t")
        inner = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", inner)
        return f'"{inner}"'

    fixed = re.sub(r'"((?:[^"\\]|\\.)*)"', _fix_string_controls, raw, flags=re.DOTALL)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass

    # Stage 3 — targeted regex to extract translated_code as last resort
    code_match = re.search(
        r'"translated_code"\s*:\s*"(.*?)"\s*,\s*"explanation"',
        raw, re.DOTALL
    )
    if code_match:
        return {
            "translated_code": code_match.group(1),
            "explanation": "Extracted via fallback parser.",
            "confidence_score": 0.5,
        }

    raise ValueError(f"Could not parse JSON from LLM response:\n{text[:500]}")


def _to_str(v: Any, fallback: str = "") -> str:
    """
    Coerce any value to a plain string.
    LLMs sometimes return lists instead of strings for text fields.
    """
    if isinstance(v, list):
        return "\n".join(str(x) for x in v)
    return str(v) if v is not None else fallback


def _log_step(state: AgentState, message: str) -> None:
    """Append a human-readable step to execution_log."""
    log: list[str] = state.get("execution_log", [])
    log.append(message)
    state["execution_log"] = log


def _append_error(state: AgentState, error: str) -> None:
    errors: list[str] = state.get("errors", [])
    errors.append(error)
    state["errors"] = errors


# ---------------------------------------------------------------------------
# Context Agent
# ---------------------------------------------------------------------------

def context_agent(
    state: AgentState,
    kb: KnowledgeBase,
    llm: BaseChatModel,
    embedding_client: Any,
) -> AgentState:
    """
    Node 1 – Context Agent

    Responsibilities:
      1. Parse source code into CodeEntity objects via Tree-sitter.
      2. Generate a query embedding for the full source code.
      3. Run hybrid retrieval (vector + graph) from the knowledge base.
      4. Summarise retrieved context via the LLM.

    Mutates:
      state['parsed_entities'], state['retrieved_context'], state['status']
    """
    logger.info("[ContextAgent] Starting for file: %s", state.get("file_path", "<unknown>"))
    state["current_node"] = "context_agent"
    _log_step(state, "ContextAgent: parsing source code.")

    source_code: str = state.get("source_code", "")
    lang_str: str = state.get("source_language", "cpp")
    file_path: str = state.get("file_path", "unknown.cpp")

    try:
        language = SourceLanguage(lang_str)
    except ValueError:
        logger.error("Unknown source language: %s", lang_str)
        _append_error(state, f"Unknown source_language: {lang_str}")
        state["status"] = MigrationStatus.FAILED.value
        return state

    # 1. Parse
    try:
        entities: list[CodeEntity] = parse_source_file(file_path, source_code, language)
        state["parsed_entities"] = [e.model_dump() for e in entities]
        _log_step(state, f"ContextAgent: extracted {len(entities)} entities.")
    except Exception as exc:
        logger.error("Parsing failed: %s", exc)
        _append_error(state, f"Parse error: {exc}")
        state["status"] = MigrationStatus.FAILED.value
        return state

    # 2. Embed
    try:
        query_embedding = get_embedding(source_code[:8000], embedding_client)
    except Exception as exc:
        logger.warning("Embedding failed, using zeros: %s", exc)
        from knowledge_base import EMBEDDING_DIM
        query_embedding = [0.0] * EMBEDDING_DIM

    # 3. Hybrid retrieval
    try:
        ctx: RetrievedContext = kb.hybrid_retrieve(
            query_embedding=query_embedding,
            query_text=source_code[:500],
            top_k=5,
            source_language=lang_str,
        )
    except Exception as exc:
        logger.error("Hybrid retrieval failed: %s", exc)
        ctx = RetrievedContext()

    # 4. LLM summarisation of context
    if ctx.vector_results or ctx.graph_results:
        # Guard: any field from Neo4j can be None — coerce to safe defaults
        def _safe_snippet(r: dict) -> str:
            name = r.get("name") or "unknown"
            code = r.get("source_code") or ""
            return f"[{name}]\n{code[:400]}"

        context_snippets = "\n\n".join(
            _safe_snippet(r)
            for r in ctx.vector_results[:3] + ctx.graph_results[:3]
        )
        system_prompt = (
            "You are an expert code analyst. Summarise the following retrieved code "
            "snippets in 3-5 sentences, focusing on patterns, algorithms, and design "
            "decisions that are relevant for migrating similar code to Python."
        )
        user_prompt = f"Retrieved context:\n\n{context_snippets}"
        try:
            summary = _invoke_llm(llm, [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)])
            ctx.combined_summary = summary
        except Exception as exc:
            logger.warning("Context summarisation failed: %s", exc)
            ctx.combined_summary = "Context summarisation unavailable."

    state["retrieved_context"] = ctx.model_dump()
    state["status"] = MigrationStatus.CONTEXT_LOADED.value
    _log_step(state, "ContextAgent: hybrid retrieval complete.")
    logger.info("[ContextAgent] Done. %d vector + %d graph results.",
                len(ctx.vector_results), len(ctx.graph_results))
    return state


# ---------------------------------------------------------------------------
# Translation Agent
# ---------------------------------------------------------------------------

_TRANSLATION_SYSTEM = textwrap.dedent("""\
    You are a senior software engineer specialising in migrating legacy C++ and Java
    codebases to idiomatic, production-grade Python 3.11+.

    Core guidelines:
    - Preserve all business logic and algorithmic behaviour exactly.
    - Use Python idioms (list comprehensions, dataclasses, type hints, pathlib, etc.).
    - Add Google-style docstrings to every function and class.
    - Replace manual memory management with Python's GC model.
    - Map STL / Java Collections to equivalent Python structures.
    - Raise exceptions instead of returning error codes.
    - Do NOT include test code in the translated output.

    Type annotation rules (CRITICAL - every annotation must be complete):
    - EVERY function including helpers and nested functions must have fully annotated
      parameters AND return type. Never leave a return type unannotated.
    - For graph adjacency lists always use: dict[int, list[int]] not list[list[int]].
    - For generic collections use lowercase: list[int], dict[str, int], set[str].
    - Convert single-expression lambdas to named functions with full annotations.

    Data structure mapping (apply consistently across the entire translation):
    - std::vector<T>        -> list[T]
    - std::unordered_map    -> dict
    - std::unordered_set    -> set
    - std::queue<T>         -> collections.deque[T]
    - std::priority_queue   -> heapq module
    - adjacency list graph  -> dict[int, list[int]]  (ALWAYS, never list[list])
    - ArrayList<T>          -> list[T]
    - HashMap<K,V>          -> dict[K,V]

    Respond ONLY with a JSON object matching this schema (no markdown fences):
    {
      "translated_code": "<complete Python code>",
      "explanation": "<step-by-step rationale>",
      "confidence_score": <float 0-1>
    }
""")


def translation_agent(
    state: AgentState,
    llm: BaseChatModel,
) -> AgentState:
    """
    Node 2 – Translation Agent

    Translates the source code to Python, injecting retrieved context and
    validation feedback (if this is a retry iteration).

    Mutates:
      state['translation_result'], state['status']
    """
    logger.info("[TranslationAgent] Iteration %d", state.get("iteration", 0))
    state["current_node"] = "translation_agent"
    _log_step(state, f"TranslationAgent: iteration {state.get('iteration', 0)}.")

    source_code: str = state.get("source_code", "")[:_MAX_CODE_CHARS]
    source_language: str = state.get("source_language", "cpp").upper()
    ctx_dict: dict = state.get("retrieved_context", {})
    context_summary: str = ctx_dict.get("combined_summary", "")

    # Collect prior validation feedback for retry iterations
    val_dict: dict = state.get("validation_result", {})
    prior_errors: list[str] = val_dict.get("errors", [])
    prior_suggestions: list[str] = val_dict.get("suggestions", [])
    prior_output: str = val_dict.get("test_output", "")

    retry_section = ""
    if state.get("iteration", 0) > 0:
        retry_section = textwrap.dedent(f"""
            === PREVIOUS ATTEMPT FAILED ===
            Errors:
            {chr(10).join(prior_errors) or 'none'}

            Subprocess output:
            {prior_output[:1000]}

            Suggestions from validator:
            {chr(10).join(prior_suggestions) or 'none'}

            Please fix the above issues in the new translation.
        """)

    user_prompt = textwrap.dedent(f"""
        Migrate the following {source_language} source code to Python 3.11+.

        === SOURCE CODE ===
        {source_code}

        === RETRIEVED CONTEXT (patterns from similar code) ===
        {context_summary or 'No prior context available.'}

        {retry_section}
    """)

    existing = state.get("translation_result", {})
    retry_count = existing.get("retry_count", 0) + (1 if state.get("iteration", 0) > 0 else 0)

    try:
        raw = _invoke_llm(llm, [SystemMessage(content=_TRANSLATION_SYSTEM), HumanMessage(content=user_prompt)])
        parsed = _parse_json_block(raw)
        result = TranslationResult(
            translated_code=_to_str(parsed.get("translated_code"), ""),
            explanation=_to_str(parsed.get("explanation"), ""),
            confidence_score=float(parsed.get("confidence_score", 0.5)),
            retry_count=retry_count,
        )
    except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
        logger.error("Translation failed: %s", exc)
        _append_error(state, f"TranslationAgent error: {exc}")
        result = TranslationResult(
            translated_code="# TRANSLATION FAILED – see errors",
            explanation=str(exc),
            confidence_score=0.0,
            retry_count=retry_count,
        )
        state["status"] = MigrationStatus.FAILED.value
        state["translation_result"] = result.model_dump()
        return state

    state["translation_result"] = result.model_dump()
    state["status"] = MigrationStatus.TRANSLATED.value
    _log_step(state, f"TranslationAgent: translated ({result.confidence_score:.0%} confidence).")
    logger.info("[TranslationAgent] Done. Confidence=%.2f", result.confidence_score)
    return state


# ---------------------------------------------------------------------------
# Optimization Agent
# ---------------------------------------------------------------------------

_OPTIMIZATION_SYSTEM = textwrap.dedent("""\
    You are an algorithm complexity expert and Python performance engineer.

    Your task:
    1. Analyse the provided Python code and identify the Big-O time and space complexity
       of every non-trivial function or algorithm.
    2. Identify any inefficiencies: unnecessary nested loops, redundant data copies,
       suboptimal data structures, missing caching opportunities, etc.
    3. Produce an optimised version of the code that maintains identical behaviour
       while improving (or at minimum preserving) the complexity class.
    4. Prefer built-in Python optimisations: itertools, functools.lru_cache,
       collections.defaultdict, heapq, bisect, numpy for numerical code, etc.

    Respond ONLY with a JSON object (no markdown fences):
    {
      "optimized_code": "<complete optimised Python code>",
      "original_complexity": "<Big-O for the most significant algorithm>",
      "optimized_complexity": "<Big-O after optimisation>",
      "optimization_notes": "<bullet-point explanation of each change>"
    }
""")


def optimization_agent(
    state: AgentState,
    llm: BaseChatModel,
) -> AgentState:
    """
    Node 3 – Optimization / Complexity Agent

    Analyses and refactors the translated Python code for efficiency.
    Updates complexity_label on parsed entities stored in state.

    Mutates:
      state['optimization_result'], state['status']
    """
    logger.info("[OptimizationAgent] Starting.")
    state["current_node"] = "optimization_agent"
    _log_step(state, "OptimizationAgent: analysing complexity.")

    trans_dict: dict = state.get("translation_result", {})
    translated_code: str = trans_dict.get("translated_code", "")

    if not translated_code or translated_code.startswith("# TRANSLATION FAILED"):
        logger.warning("OptimizationAgent: no valid code to optimise, skipping.")
        result = OptimizationResult(
            optimized_code=translated_code,
            original_complexity="N/A",
            optimized_complexity="N/A",
            optimization_notes="Skipped – translation was unavailable.",
        )
        state["optimization_result"] = result.model_dump()
        return state

    user_prompt = f"Analyse and optimise the following Python code:\n\n{translated_code[:_MAX_CODE_CHARS]}"

    try:
        raw = _invoke_llm(llm, [SystemMessage(content=_OPTIMIZATION_SYSTEM), HumanMessage(content=user_prompt)])
        parsed = _parse_json_block(raw)
        # FIX: LLMs sometimes return lists instead of strings — _to_str coerces safely
        result = OptimizationResult(
            optimized_code=_to_str(parsed.get("optimized_code"), translated_code),
            original_complexity=_to_str(parsed.get("original_complexity"), "Unknown"),
            optimized_complexity=_to_str(parsed.get("optimized_complexity"), "Unknown"),
            optimization_notes=_to_str(parsed.get("optimization_notes"), ""),
        )
    except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
        logger.error("Optimization failed: %s", exc)
        _append_error(state, f"OptimizationAgent error: {exc}")
        result = OptimizationResult(
            optimized_code=translated_code,
            original_complexity="Unknown",
            optimized_complexity="Unknown",
            optimization_notes=f"Optimisation failed: {exc}",
        )

    # Back-propagate complexity labels to parsed entities
    entities: list[dict] = state.get("parsed_entities", [])
    for e in entities:
        e["complexity_label"] = result.original_complexity
    state["parsed_entities"] = entities

    state["optimization_result"] = result.model_dump()
    state["status"] = MigrationStatus.OPTIMIZED.value
    _log_step(
        state,
        f"OptimizationAgent: {result.original_complexity} → {result.optimized_complexity}.",
    )
    logger.info(
        "[OptimizationAgent] Done. %s → %s",
        result.original_complexity,
        result.optimized_complexity,
    )
    return state


# ---------------------------------------------------------------------------
# Validation Agent
# ---------------------------------------------------------------------------

_VALIDATION_SYSTEM = textwrap.dedent("""\
    You are a Python code quality reviewer and QA engineer.

    You will receive:
    1. Optimised Python code generated by an automated migration tool.
    2. The subprocess output from running that code (may be empty or contain errors).

    Your task:
    - Identify any syntax errors, runtime exceptions, or logical issues.
    - Suggest concrete, actionable fixes for each issue found.
    - If the code looks correct and the subprocess produced no errors, mark it as passing.

    Respond ONLY with a JSON object (no markdown fences):
    {
      "outcome": "pass" | "fail",
      "errors": ["<specific error 1>", ...],
      "suggestions": ["<actionable fix 1>", ...]
    }
""")


def _run_code_in_sandbox(code: str, timeout: int = _SUBPROCESS_TIMEOUT) -> tuple[str, list[str]]:
    """
    Execute Python code in a restricted subprocess.

    Security measures applied:
    - Code is written to a temp file using tempfile.gettempdir() — works on
      Windows, Mac, and Linux (fixes the hardcoded /tmp crash on Windows).
    - Process is spawned with a fresh interpreter (no inherited globals).
    - Hard wall-clock timeout enforced.
    - stdout + stderr are captured; process is killed on timeout.

    Returns:
        (stdout_stderr, error_list)
    """
    # FIX: tempfile.gettempdir() instead of hardcoded /tmp — cross-platform
    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".py",
            prefix="rag_validate_",
            dir=tempfile.gettempdir(),
            delete=False,
            encoding="utf-8",
        ) as tmp:
            tmp.write(code)
            tmp_path = tmp.name
    except Exception as exc:
        return "", [f"Failed to create temp file: {exc}"]

    try:
        # FIX: r'{tmp_path}' raw string so Windows backslashes are not eaten
        proc = subprocess.run(
            [sys.executable, "-c", f"exec(open(r'{tmp_path}').read())"],
            capture_output=True,
            text=True,
            timeout=timeout,
            env={
                "PATH":        os.environ.get("PATH", ""),
                "PYTHONPATH":  os.environ.get("PYTHONPATH", ""),
                # FIX: Windows-compatible env vars instead of hardcoded /tmp
                "HOME":        os.environ.get("HOME",        tempfile.gettempdir()),
                "USERPROFILE": os.environ.get("USERPROFILE", ""),
                "APPDATA":     os.environ.get("APPDATA",     ""),
                "TEMP":        os.environ.get("TEMP",        tempfile.gettempdir()),
                "TMP":         os.environ.get("TMP",         tempfile.gettempdir()),
            },
        )
        output = (proc.stdout + proc.stderr).strip()
        errors: list[str] = []
        if proc.returncode != 0:
            errors.append(f"Process exited with code {proc.returncode}.")
            if proc.stderr:
                errors.append(proc.stderr.strip()[:1000])
        return output, errors
    except subprocess.TimeoutExpired:
        return "", [f"Execution timed out after {timeout}s."]
    except Exception as exc:
        return "", [f"Sandbox error: {exc}"]
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def validation_agent(
    state: AgentState,
    llm: BaseChatModel,
) -> AgentState:
    """
    Node 4 – Validation Agent

    Responsibilities:
      1. Run the optimised Python code in a sandboxed subprocess.
      2. Ask the LLM to review code + subprocess output.
      3. Set validation_result.outcome to 'pass' or 'fail'.
      4. Increment iteration counter; pipeline router checks max_iterations.

    Mutates:
      state['validation_result'], state['iteration'], state['status']
    """
    logger.info("[ValidationAgent] Starting – iteration %d.", state.get("iteration", 0))
    state["current_node"] = "validation_agent"
    _log_step(state, "ValidationAgent: running sandbox and LLM review.")

    opt_dict: dict = state.get("optimization_result", {})
    code: str = opt_dict.get("optimized_code", "")

    if not code or code.startswith("# TRANSLATION FAILED"):
        result = ValidationResult(
            outcome=ValidationOutcome.FAIL,
            test_output="No code to validate.",
            errors=["Translation produced no runnable code."],
            suggestions=["Fix the TranslationAgent prompt and retry."],
        )
        state["validation_result"] = result.model_dump()
        state["iteration"] = state.get("iteration", 0) + 1
        return state

    # Stage 1 – subprocess sandbox
    test_output, sandbox_errors = _run_code_in_sandbox(code)

    # Stage 2 – LLM review
    user_prompt = textwrap.dedent(f"""
        === PYTHON CODE ===
        {code[:_MAX_CODE_CHARS]}

        === SUBPROCESS OUTPUT ===
        {test_output[:2000] or '(no output)'}

        === SANDBOX ERRORS ===
        {chr(10).join(sandbox_errors) or 'none'}
    """)

    try:
        raw = _invoke_llm(
            llm,
            [SystemMessage(content=_VALIDATION_SYSTEM), HumanMessage(content=user_prompt)],
        )
        parsed = _parse_json_block(raw)
        outcome_str = parsed.get("outcome", "fail").lower()
        outcome = ValidationOutcome.PASS if outcome_str == "pass" else ValidationOutcome.FAIL

        # FIX: coerce errors/suggestions to lists — LLM sometimes returns a plain string
        raw_errors = parsed.get("errors", [])
        raw_suggestions = parsed.get("suggestions", [])
        if isinstance(raw_errors, str):
            raw_errors = [raw_errors]
        if isinstance(raw_suggestions, str):
            raw_suggestions = [raw_suggestions]

        result = ValidationResult(
            outcome=outcome,
            test_output=test_output,
            errors=raw_errors + sandbox_errors,
            suggestions=raw_suggestions,
        )
    except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
        logger.error("ValidationAgent LLM review failed: %s", exc)
        _append_error(state, f"ValidationAgent error: {exc}")
        result = ValidationResult(
            outcome=ValidationOutcome.FAIL,
            test_output=test_output,
            errors=[f"Review LLM failed: {exc}"] + sandbox_errors,
            suggestions=["Retry with a simpler prompt."],
        )

    state["validation_result"] = result.model_dump()
    state["iteration"] = state.get("iteration", 0) + 1

    if result.outcome == ValidationOutcome.PASS:
        state["status"] = MigrationStatus.VALIDATED.value
        _log_step(state, "ValidationAgent: PASS ✓")
    else:
        state["status"] = MigrationStatus.TRANSLATED.value  # Signal retry
        _log_step(state, f"ValidationAgent: FAIL – {len(result.errors)} error(s) found.")

    logger.info("[ValidationAgent] Outcome: %s", result.outcome.value)
    return state