"""
knowledge_base.py
Dual-database knowledge store:
  • Neo4j   – graph of code entities and their relationships (GraphRAG)
  • pgvector – vector similarity search over entity embeddings

Both connections are managed as singletons via module-level clients to avoid
repeated connection overhead in a long-running service.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

import numpy as np
import psycopg2
import psycopg2.extras
from neo4j import GraphDatabase, Session
from neo4j.exceptions import Neo4jError, ServiceUnavailable

from schema import CodeEntity, RetrievedContext

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (pulled from environment with sane defaults)
# ---------------------------------------------------------------------------

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

PG_DSN = os.getenv(
    "PG_DSN",
    "postgresql://postgres:password@localhost:5432/ragdb",
)

EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1536"))  # OpenAI text-embedding-3-small

# ---------------------------------------------------------------------------
# Neo4j Client
# ---------------------------------------------------------------------------


class Neo4jClient:
    """Thread-safe wrapper around the official Neo4j Python driver."""

    def __init__(self) -> None:
        self._driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
        )
        logger.info("Neo4j driver initialised at %s", NEO4J_URI)

    def close(self) -> None:
        self._driver.close()

    # ── Schema bootstrap ────────────────────────────────────────────────────

    def bootstrap_schema(self) -> None:
        """Create constraints and indexes required by the knowledge graph."""
        with self._driver.session() as session:
            session.run(
                "CREATE CONSTRAINT entity_id IF NOT EXISTS "
                "FOR (e:Entity) REQUIRE e.entity_id IS UNIQUE"
            )
            session.run(
                "CREATE INDEX entity_name IF NOT EXISTS "
                "FOR (e:Entity) ON (e.name)"
            )
            session.run(
                "CREATE INDEX entity_type IF NOT EXISTS "
                "FOR (e:Entity) ON (e.entity_type)"
            )
        logger.info("Neo4j schema bootstrapped.")

    # ── Write ────────────────────────────────────────────────────────────────

    def upsert_entity(self, entity: CodeEntity) -> None:
        """Create or update a code entity node in Neo4j."""
        query = """
        MERGE (e:Entity {entity_id: $entity_id})
        SET e.name            = $name,
            e.entity_type     = $entity_type,
            e.language        = $language,
            e.file_path       = $file_path,
            e.source_code     = $source_code,
            e.docstring       = $docstring,
            e.complexity_label = $complexity_label
        """
        props = {
            "entity_id": entity.entity_id,
            "name": entity.name,
            "entity_type": entity.entity_type,
            "language": entity.language.value,
            "file_path": entity.file_path,
            "source_code": entity.source_code[:4000],
            "docstring": entity.docstring or "",
            "complexity_label": entity.complexity_label or "",
        }
        try:
            with self._driver.session() as session:
                session.run(query, **props)
                self._create_dependency_edges(session, entity)
        except Neo4jError as exc:
            logger.error("Neo4j upsert failed for %s: %s", entity.name, exc)
            raise

    def _create_dependency_edges(self, session: Session, entity: CodeEntity) -> None:
        """Create DEPENDS_ON relationships for each declared dependency."""
        for dep_name in entity.dependencies:
            session.run(
                """
                MATCH (src:Entity {entity_id: $src_id})
                MERGE (dep:Entity {name: $dep_name})
                ON CREATE SET dep.entity_id = $dep_name,
                              dep.entity_type = 'external'
                MERGE (src)-[:DEPENDS_ON]->(dep)
                """,
                src_id=entity.entity_id,
                dep_name=dep_name,
            )

    def upsert_entities_batch(self, entities: list[CodeEntity]) -> None:
        """Bulk upsert a list of entities."""
        for entity in entities:
            self.upsert_entity(entity)
        logger.info("Neo4j: upserted %d entities.", len(entities))

    # ── Read ─────────────────────────────────────────────────────────────────

    def find_related_entities(
        self,
        entity_name: str,
        hop_depth: int = 2,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Traverse the dependency graph up to *hop_depth* hops from
        the named entity and return related nodes.
        """
        query = """
        MATCH (start:Entity {name: $name})
        CALL apoc.path.subgraphNodes(start, {
            relationshipFilter: 'DEPENDS_ON>|<DEPENDS_ON',
            maxLevel: $depth
        }) YIELD node
        WHERE node <> start
        RETURN node.entity_id   AS entity_id,
               node.name        AS name,
               node.entity_type AS entity_type,
               node.language    AS language,
               node.source_code AS source_code,
               node.complexity_label AS complexity_label
        LIMIT $limit
        """
        try:
            with self._driver.session() as session:
                result = session.run(query, name=entity_name, depth=hop_depth, limit=limit)
                return [dict(record) for record in result]
        except Neo4jError as exc:
            # APOC may not be installed – fall back to simple 1-hop query
            logger.warning("APOC not available, falling back to 1-hop query: %s", exc)
            return self._find_related_1hop(entity_name, limit)

    def _find_related_1hop(self, entity_name: str, limit: int) -> list[dict[str, Any]]:
        query = """
        MATCH (start:Entity {name: $name})-[:DEPENDS_ON]-(neighbour:Entity)
        RETURN neighbour.entity_id   AS entity_id,
               neighbour.name        AS name,
               neighbour.entity_type AS entity_type,
               neighbour.language    AS language,
               neighbour.source_code AS source_code,
               neighbour.complexity_label AS complexity_label
        LIMIT $limit
        """
        try:
            with self._driver.session() as session:
                result = session.run(query, name=entity_name, limit=limit)
                return [dict(record) for record in result]
        except Neo4jError as exc:
            logger.error("Neo4j 1-hop query failed: %s", exc)
            return []

    def find_by_type(self, entity_type: str, language: str, limit: int = 20) -> list[dict[str, Any]]:
        """Return entities of a given type and language."""
        query = """
        MATCH (e:Entity {entity_type: $entity_type, language: $language})
        RETURN e.entity_id AS entity_id, e.name AS name,
               e.source_code AS source_code, e.complexity_label AS complexity_label
        LIMIT $limit
        """
        with self._driver.session() as session:
            result = session.run(query, entity_type=entity_type, language=language, limit=limit)
            return [dict(r) for r in result]


# ---------------------------------------------------------------------------
# pgvector Client
# ---------------------------------------------------------------------------


class PgVectorClient:
    """
    Manages vector embeddings in PostgreSQL with the pgvector extension.
    Uses psycopg2 directly for fine-grained control; switch to asyncpg for
    async workloads if needed.
    """

    def __init__(self) -> None:
        self._conn: Optional[psycopg2.extensions.connection] = None
        self._connect()

    def _connect(self) -> None:
        self._conn = psycopg2.connect(PG_DSN)
        self._conn.autocommit = False
        logger.info("PostgreSQL connection established.")

    def _cursor(self) -> psycopg2.extensions.cursor:
        """Return a DictCursor, re-connecting if the connection was lost."""
        assert self._conn is not None
        if self._conn.closed:
            logger.warning("PG connection closed, reconnecting.")
            self._connect()
        return self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    def bootstrap_schema(self) -> None:
        """Enable pgvector extension and create the embeddings table."""
        assert self._conn is not None
        with self._cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            cur.execute(
                f"""
                CREATE TABLE IF NOT EXISTS entity_embeddings (
                    entity_id   TEXT PRIMARY KEY,
                    name        TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    language    TEXT NOT NULL,
                    file_path   TEXT NOT NULL,
                    source_code TEXT NOT NULL,
                    embedding   VECTOR({EMBEDDING_DIM}),
                    created_at  TIMESTAMPTZ DEFAULT NOW()
                );
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS entity_embedding_idx
                ON entity_embeddings USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
                """
            )
        self._conn.commit()
        logger.info("pgvector schema bootstrapped (dim=%d).", EMBEDDING_DIM)

    # ── Write ─────────────────────────────────────────────────────────────────

    def upsert_embedding(
        self,
        entity: CodeEntity,
        embedding: list[float],
    ) -> None:
        """Insert or update an entity embedding row."""
        assert len(embedding) == EMBEDDING_DIM, (
            f"Embedding dim mismatch: expected {EMBEDDING_DIM}, got {len(embedding)}"
        )
        assert self._conn is not None
        query = """
        INSERT INTO entity_embeddings
            (entity_id, name, entity_type, language, file_path, source_code, embedding)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (entity_id) DO UPDATE
            SET embedding   = EXCLUDED.embedding,
                source_code = EXCLUDED.source_code;
        """
        with self._cursor() as cur:
            cur.execute(
                query,
                (
                    entity.entity_id,
                    entity.name,
                    entity.entity_type,
                    entity.language.value,
                    entity.file_path,
                    entity.source_code[:4000],
                    embedding,
                ),
            )
        self._conn.commit()

    def upsert_embeddings_batch(
        self,
        entities: list[CodeEntity],
        embeddings: list[list[float]],
    ) -> None:
        """Bulk upsert entity embeddings."""
        assert len(entities) == len(embeddings)
        for entity, emb in zip(entities, embeddings):
            self.upsert_embedding(entity, emb)
        logger.info("pgvector: upserted %d embeddings.", len(entities))

    # ── Read ──────────────────────────────────────────────────────────────────

    def similarity_search(
        self,
        query_embedding: list[float],
        top_k: int = 5,
        language_filter: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """
        Return the *top_k* most similar entities using cosine distance.
        Optionally filter by programming language.
        """
        assert self._conn is not None
        where_clause = "WHERE language = %s" if language_filter else ""
        params: tuple[Any, ...] = (
            (query_embedding, language_filter, top_k)
            if language_filter
            else (query_embedding, top_k)
        )
        query = f"""
        SELECT entity_id,
               name,
               entity_type,
               language,
               source_code,
               1 - (embedding <=> %s::vector) AS similarity_score
        FROM entity_embeddings
        {where_clause}
        ORDER BY embedding <=> %s::vector
        LIMIT %s;
        """
        # Rebuild params with the embedding appearing twice (WHERE and ORDER BY)
        if language_filter:
            params = (query_embedding, language_filter, query_embedding, top_k)
        else:
            params = (query_embedding, query_embedding, top_k)

        with self._cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            return [dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Knowledge Base facade
# ---------------------------------------------------------------------------


class KnowledgeBase:
    """
    High-level façade that orchestrates both Neo4j and pgvector operations,
    and implements Hybrid Retrieval for GraphRAG.
    """

    def __init__(self) -> None:
        self.neo4j = Neo4jClient()
        self.pgvector = PgVectorClient()

    def bootstrap(self) -> None:
        """Idempotent setup of all database schemas."""
        self.neo4j.bootstrap_schema()
        self.pgvector.bootstrap_schema()
        logger.info("KnowledgeBase fully bootstrapped.")

    def ingest_entities(
        self,
        entities: list[CodeEntity],
        embeddings: list[list[float]],
    ) -> None:
        """
        Persist parsed entities into both stores.

        Args:
            entities:   Parsed CodeEntity objects.
            embeddings: Corresponding embedding vectors (same order).
        """
        if len(entities) != len(embeddings):
            raise ValueError("entities and embeddings must have equal length.")

        logger.info("Ingesting %d entities into knowledge base …", len(entities))
        self.neo4j.upsert_entities_batch(entities)
        self.pgvector.upsert_embeddings_batch(entities, embeddings)
        logger.info("Ingestion complete.")

    # ── Hybrid Retrieval (GraphRAG) ──────────────────────────────────────────

    def hybrid_retrieve(
        self,
        query_embedding: list[float],
        query_text: str,
        top_k: int = 5,
        source_language: Optional[str] = None,
        hop_depth: int = 2,
    ) -> RetrievedContext:
        """
        Two-stage retrieval:
          1. Vector search  – find semantically similar entities via pgvector.
          2. Graph traversal – expand each seed entity via Neo4j relationship hops.

        The union of both result sets is returned as a RetrievedContext.

        Args:
            query_embedding: Embedding of the migration query / source code.
            query_text:      Human-readable query (for logging / summarisation).
            top_k:           Number of vector nearest-neighbours.
            source_language: Optional language filter for vector search.
            hop_depth:       Max relationship hops in the graph traversal.

        Returns:
            RetrievedContext with deduplicated results from both stages.
        """
        logger.info(
            "HybridRetrieve: query='%.80s…' top_k=%d hops=%d",
            query_text,
            top_k,
            hop_depth,
        )

        # Stage 1 – Vector similarity
        vector_results: list[dict[str, Any]] = []
        try:
            vector_results = self.pgvector.similarity_search(
                query_embedding,
                top_k=top_k,
                language_filter=source_language,
            )
            logger.debug("Vector stage: %d results", len(vector_results))
        except Exception as exc:
            logger.error("Vector search failed: %s", exc)

        # Stage 2 – Graph expansion on vector seed names
        seen_ids: set[str] = {r.get("entity_id", "") for r in vector_results}
        graph_results: list[dict[str, Any]] = []

        for vr in vector_results:
            name = vr.get("name", "")
            if not name:
                continue
            try:
                neighbours = self.neo4j.find_related_entities(
                    name, hop_depth=hop_depth, limit=top_k
                )
                for n in neighbours:
                    if n.get("entity_id") not in seen_ids:
                        graph_results.append(n)
                        seen_ids.add(n.get("entity_id", ""))
            except Exception as exc:
                logger.warning("Graph traversal failed for '%s': %s", name, exc)

        logger.info(
            "HybridRetrieve complete: %d vector + %d graph results",
            len(vector_results),
            len(graph_results),
        )

        return RetrievedContext(
            vector_results=vector_results,
            graph_results=graph_results,
            combined_summary="",  # Filled by the Context Agent
        )

    def close(self) -> None:
        """Release database connections."""
        self.neo4j.close()
        if self.pgvector._conn and not self.pgvector._conn.closed:
            self.pgvector._conn.close()
        logger.info("KnowledgeBase connections closed.")


# ---------------------------------------------------------------------------
# Embedding utility (thin wrapper – swap out for any embedding model)
# ---------------------------------------------------------------------------


def get_embedding(text: str, client: Any) -> list[float]:
    """
    Generate a text embedding using the supplied LangChain embedding client.

    Falls back to a zero-vector on error so ingestion can continue partially.

    Args:
        text:   Text to embed.
        client: LangChain Embeddings instance (e.g. OpenAIEmbeddings).

    Returns:
        List of floats of length EMBEDDING_DIM.
    """
    try:
        return client.embed_query(text[:8000])
    except Exception as exc:
        logger.error("Embedding failed (%s) – returning zero vector.", exc)
        return [0.0] * EMBEDDING_DIM


def get_embeddings_batch(
    texts: list[str],
    client: Any,
    batch_size: int = 32,
) -> list[list[float]]:
    """
    Batch-embed a list of texts with retry + rate-limit back-off.

    Args:
        texts:      Texts to embed.
        client:     LangChain Embeddings instance.
        batch_size: Max texts per API call.

    Returns:
        List of embedding vectors in the same order as *texts*.
    """
    results: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        for attempt in range(3):
            try:
                batch_embeddings = client.embed_documents(batch)
                results.extend(batch_embeddings)
                break
            except Exception as exc:
                wait = 2 ** attempt
                logger.warning(
                    "Embedding batch %d failed (attempt %d/3): %s – retrying in %ds",
                    i // batch_size,
                    attempt + 1,
                    exc,
                    wait,
                )
                time.sleep(wait)
        else:
            logger.error("Embedding batch %d failed after 3 attempts; using zeros.", i // batch_size)
            results.extend([[0.0] * EMBEDDING_DIM] * len(batch))

    return results
