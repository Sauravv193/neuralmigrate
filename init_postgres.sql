-- init_postgres.sql
-- Runs automatically on first Postgres container startup.
-- Enables the pgvector extension in the ragdb database.

\c ragdb;

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- For optional text search later

-- entity_embeddings table is created by KnowledgeBase.bootstrap_schema()
-- at application startup, so we only need the extension here.

COMMENT ON DATABASE ragdb IS 'RAG System embedding store with pgvector';
