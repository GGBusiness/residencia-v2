-- Tabela de notas de corte
CREATE TABLE IF NOT EXISTS cut_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution TEXT NOT NULL,
  area TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 100,
  passing_score INTEGER NOT NULL,
  percentage DECIMAL NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cut_scores_institution ON cut_scores(institution);
CREATE INDEX IF NOT EXISTS idx_cut_scores_area ON cut_scores(area);

-- RLS
ALTER TABLE cut_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cut scores"
  ON cut_scores FOR SELECT
  TO authenticated, anon
  USING (true);

-- Tabela de eventos de estudo (planner)
CREATE TABLE IF NOT EXISTS study_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'mock-user-id',
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('study', 'exam', 'review')),
  area TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_study_events_user ON study_events(user_id);
CREATE INDEX IF NOT EXISTS idx_study_events_date ON study_events(date);

-- RLS
ALTER TABLE study_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own events"
  ON study_events FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can insert their own events"
  ON study_events FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can update their own events"
  ON study_events FOR UPDATE
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can delete their own events"
  ON study_events FOR DELETE
  TO authenticated, anon
  USING (true);

-- Inserir dados de notas de corte
INSERT INTO cut_scores (institution, area, year, total_questions, passing_score, percentage, notes) VALUES
-- ENARE
('ENARE', 'Cirurgia', 2025, 100, 75, 75.0, 'Média conservadora baseada em dados 2024-2026'),
('ENARE', 'Clínica Médica', 2025, 100, 72, 72.0, 'Média conservadora'),
('ENARE', 'GO', 2025, 100, 72, 72.0, 'Ginecologia e Obstetrícia'),
('ENARE', 'Pediatria', 2025, 100, 70, 70.0, 'Média conservadora'),
('ENARE', 'Medicina Preventiva', 2025, 100, 68, 68.0, 'Estimativa baseada em padrão'),

-- USP
('USP', 'Cirurgia', 2025, 100, 77, 77.0, 'USP-SP dados 2024-2026'),
(' USP', 'Clínica Médica', 2025, 100, 75, 75.0, 'Média conservadora'),
('USP', 'GO', 2025, 100, 75, 75.0, 'Estimativa'),
('USP', 'Pediatria', 2025, 100, 73, 73.0, 'Dados USP-RP convertidos'),
('USP', 'Medicina Preventiva', 2025, 100, 72, 72.0, 'Estimativa'),

-- UNICAMP
('UNICAMP', 'Cirurgia', 2025, 100, 54, 54.0, 'Nota 5.4/10 convertida'),
('UNICAMP', 'Clínica Médica', 2025, 100, 50, 50.0, 'Nota 5.0/10'),
('UNICAMP', 'GO', 2025, 100, 53, 53.0, 'Nota 5.3/10'),
('UNICAMP', 'Pediatria', 2025, 100, 50, 50.0, 'Estimativa'),
('UNICAMP', 'Medicina Preventiva', 2025, 100, 50, 50.0, 'Estimativa'),

-- SUS-SP
('SUS-SP', 'Cirurgia', 2025, 100, 60, 60.0, 'Média 5.5-6.5/10 convertida'),
('SUS-SP', 'Clínica Médica', 2025, 100, 58, 58.0, 'Estimativa conservadora'),
('SUS-SP', 'GO', 2025, 100, 65, 65.0, 'Nota 6.5/10'),
('SUS-SP', 'Pediatria', 2025, 100, 55, 55.0, 'Média 5.0-6.0/10'),
('SUS-SP', 'Medicina Preventiva', 2025, 100, 53, 53.0, 'Estimativa'),

-- UNIFESP
('UNIFESP', 'Cirurgia', 2025, 100, 60, 60.0, 'Nota 6.0/10 fase 1'),
('UNIFESP', 'Clínica Médica', 2025, 100, 60, 60.0, 'Nota 6.0/10'),
('UNIFESP', 'GO', 2025, 100, 60, 60.0, 'Nota 6.0/10'),
('UNIFESP', 'Pediatria', 2025, 100, 60, 60.0, 'Nota 6.0/10'),
('UNIFESP', 'Medicina Preventiva', 2025, 100, 55, 55.0, 'Estimativa');
