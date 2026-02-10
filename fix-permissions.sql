-- Ajustar permissões da tabela documents para permitir inserção

-- 1. REMOVER TODAS AS POLICIES EXISTENTES
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON documents;
DROP POLICY IF EXISTS "Enable read access for all users" ON documents;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON documents;
DROP POLICY IF EXISTS "Allow read for all" ON documents;
DROP POLICY IF EXISTS "Allow update for authenticated" ON documents;
DROP POLICY IF EXISTS "Allow delete for authenticated" ON documents;

-- 2. Desabilitar RLS temporariamente para teste
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
