-- Cria índices de performance na tabela questions
-- NÃO apaga dados, apenas otimiza consultas

-- Filtros individuais
CREATE INDEX IF NOT EXISTS idx_questions_institution ON questions(institution);
CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year);
CREATE INDEX IF NOT EXISTS idx_questions_area ON questions(area);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- Filtros compostos comuns no Monta Provas
CREATE INDEX IF NOT EXISTS idx_questions_filter_inst_year ON questions(institution, year);
CREATE INDEX IF NOT EXISTS idx_questions_filter_area_year ON questions(area, year);

-- Busca textual (opcional, se usar ILIKE)
-- CREATE INDEX IF NOT EXISTS idx_questions_text_trgm ON questions USING gin (question_text gin_trgm_ops);
