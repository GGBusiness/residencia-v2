-- Enable pgvector extension (if not already)
CREATE EXTENSION IF NOT EXISTS vector;

-- DOCUMENT EMBEDDINGS TABLE
-- Stores chunks of text from the PDF documents
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- The specific chunk of text
  embedding vector(1536), -- OpenAI text-embedding-3-small dimensions
  chunk_index INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb, -- Page number, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CREATE IVFFlat or HNSW Index for fast similarity search
-- HNSW is generally better for performance/recall trade-off
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding 
ON public.document_embeddings 
USING hnsw (embedding vector_cosine_ops);
