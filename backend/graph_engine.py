"""
graph_engine.py
LangGraph workflow + LLM factory supporting FREE-TIER providers:
  - Groq        (free cloud API — llama3-8b-8192, recommended)
  - HuggingFace (free embeddings via sentence-transformers, ~90MB)
  - Ollama      (local, zero cost — optional)
  - OpenAI      (paid, optional)
  - DeepSeek    (cheap alternative)
"""
from __future__ import annotations
import logging, os
from functools import partial
from typing import Any, Literal

from langchain_core.language_models import BaseChatModel
from langgraph.graph import END, START, StateGraph

from agents import context_agent, optimization_agent, translation_agent, validation_agent
from knowledge_base import KnowledgeBase
from schema import AgentState, MigrationStatus, ValidationOutcome

logger = logging.getLogger(__name__)


def build_llm(provider: str = "groq", **kwargs: Any) -> BaseChatModel:
    """
    Build a LangChain chat model. All providers except OpenAI are free.

    Providers:
      groq    — Free tier at console.groq.com (llama3-8b-8192 / mixtral-8x7b)
      ollama  — Local, zero cost (codellama:7b recommended)
      openai  — Paid (gpt-4o)
      deepseek— Cheap alternative
    """
    provider = provider.lower()

    if provider == "groq":
        from langchain_groq import ChatGroq  # type: ignore
        return ChatGroq(
            model=kwargs.get("model", os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")),
            temperature=kwargs.get("temperature", 0.1),
            max_tokens=kwargs.get("max_tokens", 4096),
            api_key=os.getenv("GROQ_API_KEY"),
        )

    elif provider == "ollama":
        from langchain_community.chat_models import ChatOllama  # type: ignore
        return ChatOllama(
            model=kwargs.get("model", os.getenv("OLLAMA_MODEL", "codellama:7b")),
            temperature=kwargs.get("temperature", 0.1),
            base_url=kwargs.get("base_url", os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")),
        )

    elif provider == "openai":
        from langchain_openai import ChatOpenAI  # type: ignore
        return ChatOpenAI(
            model=kwargs.get("model", "gpt-4o-mini"),
            temperature=kwargs.get("temperature", 0.1),
            max_tokens=kwargs.get("max_tokens", 4096),
            api_key=os.getenv("OPENAI_API_KEY"),
        )

    elif provider == "deepseek":
        from langchain_openai import ChatOpenAI  # type: ignore
        return ChatOpenAI(
            model=kwargs.get("model", "deepseek-coder"),
            temperature=kwargs.get("temperature", 0.1),
            max_tokens=kwargs.get("max_tokens", 4096),
            base_url="https://api.deepseek.com/v1",
            api_key=os.getenv("DEEPSEEK_API_KEY"),
        )

    else:
        raise ValueError(f"Unknown provider '{provider}'. Choose: groq, ollama, openai, deepseek")


def build_embedding_client(provider: str | None = None) -> Any:
    """
    Build an embedding client.

    Default (Option A — recommended, free, no Docker/Ollama needed):
      EMBEDDING_PROVIDER=huggingface  ->  sentence-transformers all-MiniLM-L6-v2
      ~90MB download on first run, CPU-only, completely free.

    Alternatives:
      ollama  — local Ollama daemon (requires Docker or native install)
      openai  — paid OpenAI text-embedding-3-small
    """
    provider = provider or os.getenv("EMBEDDING_PROVIDER", "huggingface")

    if provider in ("huggingface", "groq", "huggingface-fallback"):
        # Groq has no embedding API — always use HuggingFace sentence-transformers
        if provider == "groq":
            logger.info("Groq has no embedding API — using HuggingFace (all-MiniLM-L6-v2)")
        model_name = os.getenv("HF_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        logger.info("Loading HuggingFace model: %s (first run ~90MB download)", model_name)
        try:
            # Prefer the updated langchain-huggingface package (no deprecation warning)
            from langchain_huggingface import HuggingFaceEmbeddings  # type: ignore
        except ImportError:
            # Fall back to langchain-community if langchain-huggingface not installed
            from langchain_community.embeddings import HuggingFaceEmbeddings  # type: ignore
        return HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )

    elif provider == "ollama":
        from langchain_community.embeddings import OllamaEmbeddings  # type: ignore
        return OllamaEmbeddings(
            model=os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        )

    elif provider == "openai":
        from langchain_openai import OpenAIEmbeddings  # type: ignore
        return OpenAIEmbeddings(
            model="text-embedding-3-small",
            api_key=os.getenv("OPENAI_API_KEY"),
        )

    else:
        logger.warning("Unknown EMBEDDING_PROVIDER '%s' — defaulting to HuggingFace", provider)
        try:
            from langchain_huggingface import HuggingFaceEmbeddings  # type: ignore
        except ImportError:
            from langchain_community.embeddings import HuggingFaceEmbeddings  # type: ignore
        return HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )


def _route_after_validation(state: AgentState) -> Literal["translation_agent", "__end__"]:
    val = state.get("validation_result", {})
    outcome   = val.get("outcome", ValidationOutcome.FAIL.value)
    iteration = state.get("iteration", 0)
    max_iter  = state.get("max_iterations", 3)

    if outcome == ValidationOutcome.PASS.value:
        logger.info("Route: PASS → END")
        return END  # type: ignore

    if iteration < max_iter:
        logger.info("Route: FAIL iter %d/%d → translation_agent", iteration, max_iter)
        return "translation_agent"

    logger.warning("Route: max iterations reached → END (FAILED)")
    state["status"] = MigrationStatus.FAILED.value
    return END  # type: ignore


class MigrationGraph:
    """Compiled LangGraph pipeline for code migration."""

    def __init__(self, kb: KnowledgeBase, llm: BaseChatModel,
                 embedding_client: Any, max_iterations: int = 3) -> None:
        self._kb = kb
        self._llm = llm
        self._embedding_client = embedding_client
        self._max_iterations = max_iterations
        self._app = self._build()

    def _build(self) -> Any:
        bound_context   = partial(context_agent,      kb=self._kb, llm=self._llm, embedding_client=self._embedding_client)
        bound_translate = partial(translation_agent,  llm=self._llm)
        bound_optimize  = partial(optimization_agent, llm=self._llm)
        bound_validate  = partial(validation_agent,   llm=self._llm)

        builder = StateGraph(AgentState)
        builder.add_node("context_agent",      bound_context)
        builder.add_node("translation_agent",  bound_translate)
        builder.add_node("optimization_agent", bound_optimize)
        builder.add_node("validation_agent",   bound_validate)
        builder.add_edge(START, "context_agent")
        builder.add_edge("context_agent",      "translation_agent")
        builder.add_edge("translation_agent",  "optimization_agent")
        builder.add_edge("optimization_agent", "validation_agent")
        builder.add_conditional_edges(
            "validation_agent",
            _route_after_validation,
            {"translation_agent": "translation_agent", END: END},
        )
        app = builder.compile()
        logger.info("MigrationGraph compiled.")
        return app

    def _initial_state(self, source_code: str, source_language: str, file_path: str) -> AgentState:
        return {
            "source_code": source_code,
            "source_language": source_language,
            "file_path": file_path,
            "target_language": "python",
            "status": MigrationStatus.PENDING.value,
            "current_node": "start",
            "iteration": 0,
            "max_iterations": self._max_iterations,
            "parsed_entities": [],
            "retrieved_context": {},
            "translation_result": {},
            "optimization_result": {},
            "validation_result": {},
            "errors": [],
            "warnings": [],
            "execution_log": [],
        }

    def run(self, source_code: str, source_language: str,
            file_path: str = "input") -> AgentState:
        state = self._initial_state(source_code, source_language, file_path)
        logger.info("Pipeline start: %s (%s)", file_path, source_language)
        final = self._app.invoke(state)
        logger.info("Pipeline end: status=%s iter=%d", final.get("status"), final.get("iteration", 0))
        return final

    def stream(self, source_code: str, source_language: str, file_path: str = "input"):
        state = self._initial_state(source_code, source_language, file_path)
        for event in self._app.stream(state):
            for node_name, delta in event.items():
                yield node_name, delta