-- TEMPORÁRIO: Desabilitar RLS para desenvolvimento
-- Execute isso no Supabase SQL Editor para permitir inserção sem autenticação

-- Desabilitar RLS nas tabelas de usuário (APENAS PARA DESENVOLVIMENTO)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals DISABLE ROW LEVEL SECURITY;

-- Verificar status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'user_profiles', 'user_goals');

-- IMPORTANTE: Quando implementar autenticação real, REATIVE o RLS com:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
