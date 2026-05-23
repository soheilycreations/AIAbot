-- ============================================================
-- RAG System Migration - Supabase pgvector
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create doc_embeddings table (768 dimensions for Gemini)
CREATE TABLE IF NOT EXISTS doc_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  doc_id      UUID REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   vector(768),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create index for fast similarity search
CREATE INDEX IF NOT EXISTS idx_doc_embeddings_shop
  ON doc_embeddings(shop_id);

CREATE INDEX IF NOT EXISTS idx_doc_embeddings_vector
  ON doc_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Step 4: Match documents function (similarity search)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(768),
  match_shop_id   TEXT,
  match_count     INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id         UUID,
  content    TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    doc_embeddings.id,
    doc_embeddings.content,
    1 - (doc_embeddings.embedding <=> query_embedding) AS similarity
  FROM doc_embeddings
  WHERE
    doc_embeddings.shop_id = match_shop_id
    AND 1 - (doc_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY doc_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
