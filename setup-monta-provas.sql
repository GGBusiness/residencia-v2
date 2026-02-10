-- ==========================================
-- SETUP COMPLETO: MONTA PROVAS
-- ==========================================
-- Este script configura todas as tabelas necessárias
-- para o sistema de "Monta Provas" funcionar 100%

-- ==========================================
-- 1. TABELA DE QUESTÕES
-- ==========================================

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution TEXT NOT NULL,
  year INTEGER NOT NULL,
  area TEXT NOT NULL,
  subarea TEXT,
  difficulty TEXT CHECK (difficulty IN ('facil', 'media', 'dificil')),
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  option_e TEXT,
  correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D', 'E')),
  explanation TEXT,
  tags TEXT[],
  image_url TEXT,
  source_pdf_id UUID,
  source_page INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_questions_institution ON questions(institution);
CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year);
CREATE INDEX IF NOT EXISTS idx_questions_area ON questions(area);
CREATE INDEX IF NOT EXISTS idx_questions_subarea ON questions(subarea);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- ==========================================
-- 2. TABELA DE TENTATIVAS (ATTEMPTS)
-- ==========================================

CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  config JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')) DEFAULT 'in_progress',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER DEFAULT 0,
  percentage DECIMAL(5,2),
  time_spent_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON attempts(status);
CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created_at);

-- ==========================================
-- 3. TABELA DE RESPOSTAS DO USUÁRIO
-- ==========================================

CREATE TABLE IF NOT EXISTS user_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer TEXT CHECK (user_answer IN ('A', 'B', 'C', 'D', 'E', NULL)),
  is_correct BOOLEAN,
  time_spent_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_user_answers_attempt ON user_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_question ON user_answers(question_id);

-- ==========================================
-- 4. DESABILITAR RLS (TEMPORÁRIO)
-- ==========================================

ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_answers DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. QUESTÕES DE EXEMPLO
-- ==========================================
-- Inserindo 20 questões de exemplo para teste

-- CIRURGIA
INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation) VALUES

('ENARE', 2025, 'Cirurgia', 'Abdomen Agudo', 'media', 
'Paciente masculino, 35 anos, apresenta dor abdominal intensa em fossa ilíaca direita há 12 horas, acompanhada de náuseas e febre (38°C). Ao exame físico: sinal de Blumberg positivo. Qual o diagnóstico mais provável?',
'Apendicite aguda',
'Diverticulite aguda',
'Pancreatite aguda',
'Colecistite aguda',
'Obstrução intestinal',
'A',
'Quadro clássico de apendicite aguda: dor em FID, sinal de Blumberg positivo (descompressão brusca dolorosa), febre e náuseas.'),

('ENARE', 2025, 'Cirurgia', 'Trauma', 'media',
'No atendimento inicial ao politraumatizado (ATLS), qual a primeira prioridade a ser avaliada?',
'Via aérea com proteção da coluna cervical',
'Respiração e ventilação',
'Circulação com controle de hemorragia',
'Exposição completa do paciente',
'Exame neurológico',
'A',
'No protocolo ABCDE do ATLS, a primeira prioridade é sempre A (Airway) - via aérea com proteção da coluna cervical.'),

('USP', 2024, 'Cirurgia', 'Oncologia', 'dificil',
'Mulher de 45 anos com nódulo mamário de 2cm, móvel, sem linfonodomegalia axilar. Biópsia confirma carcinoma ductal invasivo. Qual a conduta inicial mais adequada?',
'Mastectomia radical modificada',
'Quadrantectomia + linfonodo sentinela',
'Radioterapia exclusiva',
'Quimioterapia neoadjuvante',
'Observação clínica',
'B',
'Para tumores <3cm sem comprometimento linfonodal clínico, a cirurgia conservadora (quadrantectomia) com pesquisa de linfonodo sentinela é adequada.'),

-- CLÍNICA MÉDICA
('ENARE', 2025, 'Clínica Médica', 'Cardiologia', 'media',
'Paciente de 60 anos com hipertensão e diabetes. Exame mostra PA 150/95 mmHg. Qual anti-hipertensivo é primeira escolha?',
'IECA (Enalapril)',
'Beta-bloqueador (Propranolol)',
'Bloqueador de canal de cálcio (Anlodipino)',
'Diurético tiazídico (Hidroclorotiazida)',
'Metildopa',
'A',
'IECA é primeira escolha em diabéticos hipertensos por efeito nefroprotetor adicional.'),

('USP', 2024, 'Clínica Médica', 'Endocrinologia', 'facil',
'Paciente com glicemia de jejum de 135 mg/dL em duas ocasiões. Qual o diagnóstico?',
'Diabetes Mellitus',
'Glicemia de jejum alterada',
'Tolerância à glicose diminuída',
'Hipoglicemia reativa',
'Normal',
'A',
'Glicemia de jejum ≥126 mg/dL em duas ocasiões confirma diagnóstico de Diabetes Mellitus.'),

-- PEDIATRIA
('ENARE', 2025, 'Pediatria', 'Imunização', 'facil',
'Qual vacina deve ser aplicada ao nascimento?',
'BCG e Hepatite B',
'BCG e Tríplice viral',
'Hepatite B e Pentavalente',
'Apenas BCG',
'Apenas Hepatite B',
'A',
'Ao nascimento são aplicadas BCG (dose única) e primeira dose de Hepatite B.'),

('USP', 2024, 'Pediatria', 'Neonatologia', 'media',
'Recém-nascido a termo, 10 minutos de vida, com frequência cardíaca 80 bpm, respiração irregular, cianose central. Qual a conduta imediata?',
'Ventilação com pressão positiva',
'massagem cardíaca',
'Adrenalina endovenosa',
'Observação',
'Oxigênio por cateter nasal',
'A',
'FC <100 bpm após secagem e aquecimento indica necessidade de ventilação com pressão positiva (VPP).'),

-- GINECOLOGIA E OBSTETRÍCIA
('ENARE', 2025, 'GO', 'Pré-natal', 'media',
'Gestante de 28 semanas com PA 150/100 mmHg e proteinúria 2+. Diagnóstico mais provável?',
'Pré-eclâmpsia',
'Hipertensão crônica',
'Hipertensão gestacional',
'Eclâmpsia',
'Síndrome HELLP',
'A',
'Hipertensão após 20 semanas + proteinúria caracteriza pré-eclâmpsia.'),

('USP', 2024, 'GO', 'Ginecologia', 'media',
'Mulher de 30 anos com sangramento uterino aumentado, útero aumentado de volume, regular, móvel. USG mostra útero de 14cm. Diagnóstico?',
'Leiomioma uterino',
'Adenomiose',
'Câncer de endométrio',
'Pólipo endometrial',
'Endometriose',
'A',
'Útero aumentado, regular e móvel com sangramento aumentado sugere leiomioma (mioma) uterino.'),

-- MEDICINA PREVENTIVA
('ENARE', 2025, 'Medicina Preventiva', 'Epidemiologia', 'facil',
'Qual nível de prevenção corresponde ao rastreamento de câncer de mama por mamografia?',
'Prevenção primária',
'Prevenção secundária',
'Prevenção terciária',
'Prevenção quaternária',
'Prevenção quinternária',
'B',
'Rastreamento (screening) é prevenção secundária - diagnóstico precoce em assintomáticos.'),

('USP', 2024, 'Medicina Preventiva', 'Saúde Pública', 'media',
'Em um surto de doença transmissível, qual medida caracteriza vigilância epidemiológica?',
'Notificação compulsória',
'Aplicação de vacinas',
'Tratamento dos doentes',
'Isolamento dos pacientes',
'Campanha educativa',
'A',
'Notificação compulsória é instrumento fundamental da vigilância epidemiológica para monitoramento de doenças.');

-- Mais questões para completar 20
INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer, explanation) VALUES

('UNICAMP', 2024, 'Cirurgia', 'Vascular', 'dificil',
'Paciente com varizes de membros inferiores classe CEAP C3. Qual a melhor conduta inicial?',
'Cirurgia de safena',
'Escleroterapia',
'Tratamento conservador com meia elástica',
'Laser endovenoso',
'Observação',
'C',
'CEAP C3 (edema) ainda permite tratamento conservador com meia elástica e medidas gerais.'),

('SUS-SP', 2024, 'Clínica Médica', 'Pneumologia', 'media',
'Paciente com tosse produtiva há 3 semanas, febre vespertina e sudorese noturna. Suspeita?',
'Tuberculose pulmonar',
'Pneumonia bacteriana',
'Bronquite crônica',
'Asma brônquica',
'Câncer de pulmão',
'A',
'Quadro clássico de tuberculose: tosse > 3 semanas, febre vespertina, sudorese noturna.'),

('UNIFESP', 2024, 'Pediatria', 'Infectologia', 'media',
'Criança de 5 anos com febre alta, odinofagia e exsudato amigdaliano. Conduta?',
'Teste rápido para estreptococo e tratamento',
'Amoxicilina por 10 dias imediatamente',
'Dipirona e observação',
'Azitromicina por 3 dias',
'Anti-inflamatório apenas',
'A',
'Suspeita de faringotonsilite estreptocócica - test rápido ou cultura antes de antibiótico.'),

('ENARE', 2024, 'GO', 'Obstetrícia', 'dificil',
'Gestante de 38 semanas com líquido amniótico com mecônio espesso. Conduta no parto?',
'Aspiração de vias aéreas se RN não vigoroso',
'Aspiração oro-nasal rotineira',
'Aspiração traqueal em todos os casos',
'Não fazer nenhuma aspiração',
'Apenas observação',
'A',
'Mecônio espesso: aspirar vias aéreas APENAS se RN não vigoroso (FC <100, respiração irregular, hipotonia).'),

('USP', 2024, 'Medicina Preventiva', 'Atenção Primária', 'facil',
'Qual o rastreamento recomendado para câncer colorretal na população de risco habitual?',
'Pesquisa de sangue oculto nas fezes anual a partir dos 50 anos',
'Colonoscopia anual a partir dos 40 anos',
'Tomografia abdominal bienal',
'Apenas investigar sintomáticos',
'Retossigmoidoscopia semestral',
'A',
'Rastreamento de câncer colorretal: sangue oculto fezes anual OU colonoscopia 10/10 anos a partir de 50 anos.'),

('ENARE', 2024, 'Cirurgia', 'Gastro', 'media',
'Paciente com hérnia inguinal irredutível e dolorosa há 6 horas. Conduta?',
'Cirurgia de urgência',
'Redução manual sob analgesia',
'Observação por 24h',
'Antibiótico e observação',
'Tomografia antes de decidir',
'A',
'Hérnia irredutível e dolorosa sugere encarceramento/estrangulamento - cirurgia urgente.'),

('UNICAMP', 2024, 'Clínica Médica', 'Gastro', 'media',
'Homem de 50 anos com pirose e regurgitação há 6 meses. Exam complement indicado?',
'Endoscopia digestiva alta',
'pHmetria 24h',
'Radiografia contrastada',
'Tomografia de abdome',
'Apenas tratamento empírico',
'A',
'Sintomas típicos de DRGE > 4 semanas ou >50 anos - endoscopia para afastar complicações.'),

('SUS-SP', 2024, 'Pediatria', 'Aleitamento', 'facil',
'Até que idade é recomendado aleitamento materno exclusivo?',
'6 meses',
'4 meses',
'1 ano',
'2 anos',
'3 meses',
'A',
'OMS e MS recomendam aleitamento materno exclusivo até 6 meses.'),

('UNIFESP', 2024, 'GO', 'Climatério', 'media',
'Mulher de 52 anos com amenorreia há 1 ano e fogachos intensos. Tratamento de escolha?',
'Terapia hormonal (estrogênio + progesterona)',
'Antidepressivos',
'Apenas medidas comportamentais',
'Fitoterapia',
'Observação',
'A',
'Fogachos intensos em mulher com útero: terapia hormonal combinada (estrogênio + progesterona).');

-- ==========================================
-- 6. VERIFICAÇÃO
-- ==========================================

-- Contar questões por instituição
SELECT institution, COUNT(*) as total
FROM questions
GROUP BY institution
ORDER BY total DESC;

-- Contar questões por área
SELECT area, COUNT(*) as total
FROM questions
GROUP BY area
ORDER BY total DESC;
