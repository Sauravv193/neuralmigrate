"""
parsers.py
AST extraction using Tree-sitter for C++ and Java source files.

Tree-sitter grammars are loaded lazily so the module can be imported even
if the shared libraries are not yet compiled (CI / test environments).
"""

from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional Tree-sitter import – falls back to regex heuristics when absent
# ---------------------------------------------------------------------------

try:
    from tree_sitter import Language, Node, Parser  # type: ignore
    from tree_sitter_languages import get_language, get_parser  # type: ignore

    _TREESITTER_AVAILABLE = True
    logger.info("Tree-sitter is available – full AST parsing enabled.")
except ImportError:
    _TREESITTER_AVAILABLE = False
    logger.warning(
        "tree_sitter / tree_sitter_languages not found. "
        "Falling back to regex-based heuristics for entity extraction."
    )

from schema import ASTNode, CodeEntity, SourceLanguage


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _entity_id(name: str, file_path: str, source_code: str) -> str:
    """Stable SHA-256-based ID for a code entity."""
    payload = f"{file_path}::{name}::{source_code[:200]}"
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _extract_docstring(source: str, language: SourceLanguage) -> Optional[str]:
    """Best-effort docstring / Javadoc extraction from raw source."""
    if language == SourceLanguage.JAVA:
        match = re.search(r"/\*\*(.*?)\*/", source, re.DOTALL)
        return match.group(1).strip() if match else None
    # C++ Doxygen-style
    match = re.search(r"/\*\*(.*?)\*/|///(.*?)$", source, re.DOTALL | re.MULTILINE)
    return (match.group(1) or match.group(2) or "").strip() if match else None


# ---------------------------------------------------------------------------
# Tree-sitter-based parser
# ---------------------------------------------------------------------------


def _ts_walk(node: "Node", depth: int = 0) -> list[ASTNode]:
    """
    Recursively walk a Tree-sitter node tree and collect named nodes.
    Returns a flat list of ASTNode objects.
    """
    results: list[ASTNode] = []
    if node.is_named:
        ast_node = ASTNode(
            node_type=node.type,
            name=node.child_by_field_name("name").text.decode() if node.child_by_field_name("name") else None,
            start_line=node.start_point[0],
            end_line=node.end_point[0],
            children=[c.type for c in node.children if c.is_named],
            raw_text=node.text.decode()[:500] if node.text else None,
        )
        results.append(ast_node)
    for child in node.children:
        results.extend(_ts_walk(child, depth + 1))
    return results


def _extract_entities_treesitter(
    source_code: str,
    file_path: str,
    language: SourceLanguage,
) -> list[CodeEntity]:
    """Parse entities using Tree-sitter grammar."""
    lang_name = "cpp" if language == SourceLanguage.CPP else "java"

    try:
        parser = get_parser(lang_name)
    except Exception as exc:
        logger.error("Failed to load Tree-sitter grammar for %s: %s", lang_name, exc)
        return []

    tree = parser.parse(source_code.encode())
    root = tree.root_node
    ast_nodes = _ts_walk(root)

    # Entity node types we care about
    entity_types = {
        "function_definition": "function",
        "method_declaration": "function",
        "constructor_declaration": "function",
        "class_declaration": "class",
        "class_specifier": "class",
        "struct_specifier": "class",
        "namespace_definition": "module",
        "package_declaration": "module",
    }

    entities: list[CodeEntity] = []
    for node in ast_nodes:
        if node.node_type not in entity_types:
            continue

        entity_type = entity_types[node.node_type]
        name = node.name or f"anonymous_{node.start_line}"
        snippet = node.raw_text or ""

        entity = CodeEntity(
            entity_id=_entity_id(name, file_path, snippet),
            name=name,
            entity_type=entity_type,
            language=language,
            file_path=file_path,
            source_code=snippet,
            docstring=_extract_docstring(snippet, language),
            ast_nodes=[node],
        )
        entities.append(entity)

    logger.debug(
        "Tree-sitter extracted %d entities from %s", len(entities), file_path
    )
    return entities


# ---------------------------------------------------------------------------
# Regex-based fallback parser
# ---------------------------------------------------------------------------


def _extract_entities_regex(
    source_code: str,
    file_path: str,
    language: SourceLanguage,
) -> list[CodeEntity]:
    """
    Regex heuristics – used when Tree-sitter is not available.
    Handles common C++ / Java patterns only.
    """
    entities: list[CodeEntity] = []
    lines = source_code.splitlines()

    if language == SourceLanguage.JAVA:
        # Match class, interface, enum declarations
        class_pattern = re.compile(
            r"^\s*(public|protected|private|abstract|final)?\s*(class|interface|enum)\s+(\w+)"
        )
        method_pattern = re.compile(
            r"^\s*(public|protected|private|static|final|synchronized)?\s*"
            r"[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+)?\s*\{"
        )
    else:  # C++
        class_pattern = re.compile(r"^\s*(class|struct|namespace)\s+(\w+)")
        method_pattern = re.compile(
            r"^\s*(?:(?:virtual|static|inline|explicit|constexpr)\s+)*"
            r"[\w:*&<>]+\s+(\w+)\s*\([^)]*\)\s*(?:const)?\s*(?:override|final)?\s*[{;]"
        )

    for i, line in enumerate(lines):
        # Class / struct
        m = class_pattern.match(line)
        if m:
            name = m.group(3) if language == SourceLanguage.JAVA else m.group(2)
            snippet = "\n".join(lines[max(0, i - 2) : min(len(lines), i + 30)])
            entities.append(
                CodeEntity(
                    entity_id=_entity_id(name, file_path, snippet),
                    name=name,
                    entity_type="class",
                    language=language,
                    file_path=file_path,
                    source_code=snippet,
                    docstring=_extract_docstring(snippet, language),
                )
            )
            continue

        # Function / method
        m = method_pattern.match(line)
        if m:
            name = m.group(2) if language == SourceLanguage.JAVA else m.group(1)
            snippet = "\n".join(lines[max(0, i - 2) : min(len(lines), i + 20)])
            entities.append(
                CodeEntity(
                    entity_id=_entity_id(name, file_path, snippet),
                    name=name,
                    entity_type="function",
                    language=language,
                    file_path=file_path,
                    source_code=snippet,
                    docstring=_extract_docstring(snippet, language),
                )
            )

    logger.debug(
        "Regex fallback extracted %d entities from %s", len(entities), file_path
    )
    return entities


# ---------------------------------------------------------------------------
# Dependency extraction
# ---------------------------------------------------------------------------


def _extract_dependencies_cpp(source_code: str) -> list[str]:
    """Extract #include and function-call identifiers from C++."""
    includes = re.findall(r'#include\s+["<]([\w./]+)[">]', source_code)
    calls = re.findall(r"\b(\w+)\s*\(", source_code)
    # Filter common noise
    noise = {"if", "for", "while", "switch", "return", "sizeof", "assert"}
    return list({x for x in includes + calls if x not in noise})[:50]


def _extract_dependencies_java(source_code: str) -> list[str]:
    """Extract import statements and method calls from Java."""
    imports = re.findall(r"import\s+([\w.]+);", source_code)
    calls = re.findall(r"\b(\w+)\s*\(", source_code)
    noise = {"if", "for", "while", "switch", "return", "new", "super", "this"}
    return list({x for x in imports + calls if x not in noise})[:50]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def parse_source_file(file_path: str, source_code: str, language: SourceLanguage) -> list[CodeEntity]:
    """
    Parse a source file and return a list of CodeEntity objects.

    Tries Tree-sitter first; falls back to regex heuristics.

    Args:
        file_path:   Absolute or relative path to the source file.
        source_code: Raw text content of the file.
        language:    SourceLanguage enum value.

    Returns:
        List of CodeEntity objects ready for knowledge-graph ingestion.
    """
    logger.info("Parsing %s (%s)", file_path, language.value)

    if _TREESITTER_AVAILABLE:
        entities = _extract_entities_treesitter(source_code, file_path, language)
    else:
        entities = _extract_entities_regex(source_code, file_path, language)

    if not entities:
        # Always emit at least a module-level entity for the file
        entities = [
            CodeEntity(
                entity_id=_entity_id("__module__", file_path, source_code),
                name=Path(file_path).stem,
                entity_type="module",
                language=language,
                file_path=file_path,
                source_code=source_code[:2000],
                docstring=_extract_docstring(source_code, language),
            )
        ]

    # Enrich with dependencies
    dep_fn = (
        _extract_dependencies_java
        if language == SourceLanguage.JAVA
        else _extract_dependencies_cpp
    )
    global_deps = dep_fn(source_code)

    for entity in entities:
        if not entity.dependencies:
            entity.dependencies = dep_fn(entity.source_code)
        # Merge with file-level deps (deduplicated)
        entity.dependencies = list(set(entity.dependencies + global_deps))[:30]

    return entities


def parse_folder(folder_path: str) -> list[CodeEntity]:
    """
    Recursively parse all .cpp, .cc, .cxx, .h, .hpp and .java files
    in a directory tree.

    Args:
        folder_path: Path to the root directory.

    Returns:
        Flat list of all extracted CodeEntity objects.
    """
    root = Path(folder_path)
    if not root.exists():
        raise FileNotFoundError(f"Folder not found: {folder_path}")

    extensions: dict[str, SourceLanguage] = {
        ".cpp": SourceLanguage.CPP,
        ".cc": SourceLanguage.CPP,
        ".cxx": SourceLanguage.CPP,
        ".h": SourceLanguage.CPP,
        ".hpp": SourceLanguage.CPP,
        ".java": SourceLanguage.JAVA,
    }

    all_entities: list[CodeEntity] = []

    for ext, lang in extensions.items():
        for file in root.rglob(f"*{ext}"):
            try:
                source = file.read_text(encoding="utf-8", errors="replace")
                entities = parse_source_file(str(file), source, lang)
                all_entities.extend(entities)
            except Exception as exc:
                logger.error("Failed to parse %s: %s", file, exc)

    logger.info(
        "Folder parse complete: %d entities from %s", len(all_entities), folder_path
    )
    return all_entities
