"""
schema.py
Pydantic models and TypedDict definitions for the LangGraph AgentState.
All inter-node communication passes through this shared state object.
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field
from typing_extensions import TypedDict

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class SourceLanguage(str, Enum):
    CPP = "cpp"
    JAVA = "java"


class MigrationStatus(str, Enum):
    PENDING = "pending"
    CONTEXT_LOADED = "context_loaded"
    TRANSLATED = "translated"
    OPTIMIZED = "optimized"
    VALIDATED = "validated"
    FAILED = "failed"


class ValidationOutcome(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    SKIP = "skip"


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class ASTNode(BaseModel):
    """Represents a simplified AST node extracted by Tree-sitter."""

    node_type: str = Field(..., description="Tree-sitter node type (e.g. 'function_definition')")
    name: Optional[str] = Field(None, description="Identifier name if applicable")
    start_line: int = Field(..., ge=0)
    end_line: int = Field(..., ge=0)
    children: list[str] = Field(default_factory=list, description="Child node types")
    raw_text: Optional[str] = Field(None, description="Raw source snippet for this node")


class CodeEntity(BaseModel):
    """A code entity (function/class/module) stored in the knowledge graph."""

    entity_id: str = Field(..., description="Unique identifier (SHA-256 prefix of content)")
    name: str
    entity_type: str = Field(..., description="'function' | 'class' | 'module'")
    language: SourceLanguage
    file_path: str
    source_code: str
    docstring: Optional[str] = None
    complexity_label: Optional[str] = Field(None, description="Big-O label e.g. 'O(n log n)'")
    dependencies: list[str] = Field(default_factory=list, description="Names of entities this one calls/imports")
    ast_nodes: list[ASTNode] = Field(default_factory=list)


class RetrievedContext(BaseModel):
    """Aggregated context returned by hybrid retrieval."""

    vector_results: list[dict[str, Any]] = Field(
        default_factory=list,
        description="pgvector similarity search results with score",
    )
    graph_results: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Neo4j relationship traversal results",
    )
    combined_summary: str = Field("", description="LLM-generated synthesis of retrieved context")


class TranslationResult(BaseModel):
    """Output from the Translation Agent."""

    translated_code: str = Field("", description="Generated Python code")
    explanation: str = Field("", description="Step-by-step translation rationale")
    confidence_score: float = Field(0.0, ge=0.0, le=1.0)
    retry_count: int = Field(0, ge=0)


class OptimizationResult(BaseModel):
    """Output from the Optimization / Complexity Agent."""

    optimized_code: str = Field("", description="Refactored Python code")
    original_complexity: str = Field("", description="Detected Big-O of input code")
    optimized_complexity: str = Field("", description="Detected Big-O after refactor")
    optimization_notes: str = Field("", description="Explanation of changes")


class ValidationResult(BaseModel):
    """Output from the Validation Agent."""

    outcome: ValidationOutcome = ValidationOutcome.SKIP
    test_output: str = Field("", description="stdout/stderr from subprocess run")
    errors: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Master AgentState (TypedDict for LangGraph compatibility)
# ---------------------------------------------------------------------------


class AgentState(TypedDict, total=False):
    """
    Shared mutable state passed between every node in the LangGraph workflow.

    LangGraph requires a TypedDict; we embed Pydantic models as plain dicts
    (serialised via .model_dump()) to keep the graph serialisable.
    """

    # ── Input ──────────────────────────────────────────────────────────────
    source_code: str                        # Raw source to migrate
    source_language: str                    # 'cpp' | 'java'
    file_path: str                          # Original file path (for logging)
    target_language: str                    # Always 'python' for now

    # ── Pipeline control ───────────────────────────────────────────────────
    status: str                             # MigrationStatus value
    current_node: str                       # Name of last-executing node
    iteration: int                          # Feedback-loop iteration counter
    max_iterations: int                     # Max allowed retries

    # ── Agent outputs (stored as dicts for JSON serialisability) ───────────
    parsed_entities: list[dict[str, Any]]   # List[CodeEntity.model_dump()]
    retrieved_context: dict[str, Any]       # RetrievedContext.model_dump()
    translation_result: dict[str, Any]      # TranslationResult.model_dump()
    optimization_result: dict[str, Any]     # OptimizationResult.model_dump()
    validation_result: dict[str, Any]       # ValidationResult.model_dump()

    # ── Errors / diagnostics ───────────────────────────────────────────────
    errors: list[str]
    warnings: list[str]
    execution_log: list[str]                # Human-readable step log
