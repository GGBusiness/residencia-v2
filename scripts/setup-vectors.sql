-- 1. Ativar a extensão de vetores (pgvector)
create extension if not exists vector;

-- 2. Criar tabela para armazenar os "pensamentos" da IA sobre as questões
create table if not exists question_embeddings (
  id bigint primary key generated always as identity,
  question_id uuid not null references questions(id) on delete cascade,
  content text not null, -- O texto da questão que foi "lido" pela IA
  embedding vector(1536) -- O "pensamento" matemático (1536 dimensões é o padrão da OpenAI)
);

-- 3. Criar função de busca por similaridade (o cérebro da busca)
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  question_id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    question_embeddings.id,
    question_embeddings.question_id,
    question_embeddings.content,
    1 - (question_embeddings.embedding <=> query_embedding) as similarity
  from question_embeddings
  where 1 - (question_embeddings.embedding <=> query_embedding) > match_threshold
  order by question_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 4. Criar índice para deixar a busca rápida (HNSW)
create index on question_embeddings using hnsw (embedding vector_cosine_ops);
