-- Tabela para guardar o progresso de cada usuário em cada questão
create table if not exists user_question_progress (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  
  -- Campos do Algoritmo FSRS / SM-2
  stability float not null default 0, -- Quão forte é a memória (em dias)
  difficulty float not null default 0, -- Quão difícil é a questão (0-10 ou similar)
  repetition_count int not null default 0, -- Quantas vezes já viu
  
  last_review_at timestamptz default now(), -- Quando estudou pela última vez
  next_review_at timestamptz default now(), -- Quando deve estudar de novo
  
  state text not null default 'New', -- 'New', 'Learning', 'Review', 'Relearning'
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Garante que o usuário só tenha 1 registro por questão
  unique(user_id, question_id)
);

-- Ativar segurança (RLS)
alter table user_question_progress enable row level security;

-- Política: Usuário só vê o próprio progresso
create policy "Users can view own progress"
on user_question_progress for select
using (auth.uid() = user_id);

-- Política: Usuário pode inserir seu próprio progresso
create policy "Users can insert own progress"
on user_question_progress for insert
with check (auth.uid() = user_id);

-- Política: Usuário pode atualizar seu próprio progresso
create policy "Users can update own progress"
on user_question_progress for update
using (auth.uid() = user_id);

-- Criar índice para buscar rapidamente "O que tenho para revisar hoje?"
create index idx_next_review on user_question_progress(user_id, next_review_at);
