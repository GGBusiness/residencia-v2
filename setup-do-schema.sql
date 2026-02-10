-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- Enable pgvector for future AI usage

-- PROFILES (Sync from Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY, -- Matches Supabase Auth ID
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DOCUMENTS (Provas)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'PROVA', 'SIMULADO', etc.
  year INTEGER,
  program TEXT,
  institution TEXT,
  area TEXT,
  tags TEXT[], -- Array of strings
  has_answer_key BOOLEAN DEFAULT FALSE,
  pdf_url TEXT, -- URL in Spaces
  metadata JSONB DEFAULT '{}'::jsonb,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QUESTIONS (Questões)
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  number_in_exam INTEGER,
  stem TEXT NOT NULL, -- O enunciado principal
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  option_e TEXT,
  correct_option CHAR(1), -- 'A', 'B', 'C', 'D', 'E'
  explanation TEXT,
  area TEXT,
  subarea TEXT,
  topic TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ATTEMPTS (Tentativas de Prova)
CREATE TABLE IF NOT EXISTS public.attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  config JSONB NOT NULL, -- Configurações da prova (filtros etc)
  status TEXT DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED'
  score INTEGER,
  total_questions INTEGER,
  timer_seconds INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- ATTEMPT ANSWERS (Respostas do Usuário)
CREATE TABLE IF NOT EXISTS public.attempt_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attempt_id UUID REFERENCES public.attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id),
  question_index INTEGER, -- Posição na prova gerada
  choice CHAR(1), -- A escolha do usuário
  is_correct BOOLEAN,
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(attempt_id, question_index)
);

-- USER PREFERENCES (Metas, Configs)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id),
  target_institutions TEXT[],
  target_areas TEXT[],
  study_goal_hours_per_week INTEGER,
  dark_mode BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_year ON public.documents(year);
CREATE INDEX IF NOT EXISTS idx_documents_institution ON public.documents(institution);
CREATE INDEX IF NOT EXISTS idx_questions_document_id ON public.questions(document_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
