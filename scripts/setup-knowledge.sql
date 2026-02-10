-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Table to store metadata about the documents (PDFs)
create table if not exists knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  file_type text not null, -- 'pdf', 'text', etc
  source_url text, -- file path or url
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table to store the chunks and their embeddings
create table if not exists knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid references knowledge_docs(id) on delete cascade,
  content text not null, -- the actual text chunk
  embedding vector(1536), -- 1536 is the dimension for text-embedding-3-small
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for faster similarity search
create index on knowledge_embeddings using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Function to search for similar documents
create or replace function match_knowledge (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  doc_id uuid,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    knowledge_embeddings.id,
    knowledge_embeddings.content,
    knowledge_embeddings.doc_id,
    1 - (knowledge_embeddings.embedding <=> query_embedding) as similarity
  from knowledge_embeddings
  where 1 - (knowledge_embeddings.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
end;
$$;
