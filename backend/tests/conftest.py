"""
conftest.py — shared pytest fixtures and isolation helpers.

The test_api tests stub out heavy modules (LangChain, Neo4j, etc.)
via sys.modules so they can run without GPU or cloud credentials.
This conftest scopes those stubs to the api test module only,
preventing them from bleeding into test_parsers and test_schema.
"""
import os
import sys
import copy
import pytest
from unittest.mock import MagicMock

# Heavy modules that test_api.py needs to mock
_HEAVY_MODULES = [
    "langchain", "langchain.schema", "langchain_core",
    "langchain_core.language_models", "langchain_core.messages",
    "langchain_community", "langchain_community.chat_models",
    "langchain_groq", "langchain_openai",
    "langgraph", "langgraph.graph",
    "neo4j", "neo4j.exceptions",
    "psycopg2", "psycopg2.extras", "psycopg2.extensions",
    "pgvector",
    "graph_engine", "knowledge_base",
]


@pytest.fixture(scope="session", autouse=False)
def stub_heavy_modules():
    """
    Inject lightweight MagicMock stubs for cloud/GPU modules.
    Scoped to session; only activated when explicitly requested.
    """
    saved = {k: sys.modules.get(k) for k in _HEAVY_MODULES}
    for mod in _HEAVY_MODULES:
        if mod not in sys.modules:
            sys.modules[mod] = MagicMock()

    # Keep real numpy so pytest.approx works
    import importlib
    try:
        real_numpy = importlib.import_module("numpy")
        sys.modules["numpy"] = real_numpy
    except ImportError:
        pass

    yield

    # Restore original sys.modules state
    for mod, orig in saved.items():
        if orig is None:
            sys.modules.pop(mod, None)
        else:
            sys.modules[mod] = orig
