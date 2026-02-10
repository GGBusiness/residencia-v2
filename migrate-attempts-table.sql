-- ==========================================
-- MIGRAÇÃO: Completar estrutura do Monta Provas
-- ==========================================
-- Este script adiciona colunas que faltam nas tabelas existentes

-- 1. Adicionar colunas faltantes em ATTEMPTS (se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attempts' AND column_name = 'config'
    ) THEN
        ALTER TABLE attempts ADD COLUMN config JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attempts' AND column_name = 'status'
    ) THEN
        ALTER TABLE attempts ADD COLUMN status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')) DEFAULT 'in_progress';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attempts' AND column_name = 'total_questions'
    ) THEN
        ALTER TABLE attempts ADD COLUMN total_questions INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attempts' AND column_name = 'correct_answers'
    ) THEN
        ALTER TABLE attempts ADD COLUMN correct_answers INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attempts' AND column_name = 'percentage'
    ) THEN
        ALTER TABLE attempts ADD COLUMN percentage DECIMAL(5,2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attempts' AND column_name = 'time_spent_seconds'
    ) THEN
        ALTER TABLE attempts ADD COLUMN time_spent_seconds INTEGER;
    END IF;
END $$;

-- Verificar estrutura atual
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attempts'
ORDER BY ordinal_position;
