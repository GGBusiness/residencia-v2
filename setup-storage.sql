-- 1. Criar bucket para armazenar PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('provas', 'provas', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Limpar policies existentes (se houver)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;

-- 3. Criar policy para uploads autenticados
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'provas');

-- 4. Criar policy para leitura pública dos PDFs
CREATE POLICY "Allow public downloads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'provas');

-- 5. Criar policy para atualização autenticada
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'provas');

-- 6. Criar policy para deleção autenticada
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'provas');
