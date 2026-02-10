-- Adiciona colunas faltantes na tabela users para corrigir erro de Schema Cache
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS intended_residency TEXT,
ADD COLUMN IF NOT EXISTS semester INTEGER,
ADD COLUMN IF NOT EXISTS university TEXT;

-- Atualiza o cache do schema (truque para forçar o Supabase a reconhecer)
NOTIFY pgrst, 'reload schema';
