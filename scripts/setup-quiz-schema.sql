-- Documents Table (Provas/PDFs)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT, -- 'PROVA', 'GABARITO', etc.
    year INTEGER,
    program TEXT, -- 'ENARE', etc.
    institution TEXT,
    area TEXT, -- 'MEDICA', etc.
    tags TEXT[],
    has_answer_key BOOLEAN DEFAULT FALSE,
    pdf_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    number_in_exam INTEGER,
    stem TEXT, -- Enunciado
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    option_e TEXT,
    correct_option TEXT, -- 'A', 'B', etc.
    explanation TEXT,
    area TEXT, -- 'CLINICA', 'CIRURGIA', etc.
    subarea TEXT,
    topic TEXT,
    difficulty TEXT, -- 'FACIL', 'MEDIA', 'DIFICIL'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attempts Table (Tentativas de Prova/Simulado)
CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    attempt_type TEXT, -- 'SIMULADO', 'CUSTOM', etc.
    config JSONB DEFAULT '{}',
    status TEXT DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED'
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    percentage DECIMAL(5,2),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    timer_seconds INTEGER, -- Tempo gasto ou limite
    feedback_mode TEXT -- 'PROVA' | 'ESTUDO'
);

-- Attempt Answers (Respostas do Usuário na Tentativa)
CREATE TABLE IF NOT EXISTS attempt_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES attempts(id) ON DELETE CASCADE,
    question_index INTEGER, -- Índice na ordem da prova gerada (0, 1, 2...)
    question_id UUID REFERENCES questions(id), -- Opcional, se quisermos linkar direto
    choice TEXT, -- 'A', 'B', etc.
    is_correct BOOLEAN,
    flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(attempt_id, question_index)
);

-- User Preferences (Preferências do Usuário)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'light',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    study_schedule JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Question Progress (FSRS / Spaced Repetition)
CREATE TABLE IF NOT EXISTS user_question_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    stability DECIMAL,
    difficulty DECIMAL,
    repetition_count INTEGER,
    last_review_at TIMESTAMP WITH TIME ZONE,
    next_review_at TIMESTAMP WITH TIME ZONE,
    state INTEGER, -- 0: New, 1: Learning, 2: Review, 3: Relearning
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, question_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_year ON documents(year);
CREATE INDEX IF NOT EXISTS idx_documents_institution ON documents(institution);
CREATE INDEX IF NOT EXISTS idx_questions_document ON questions(document_id);
CREATE INDEX IF NOT EXISTS idx_questions_area ON questions(area);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_question_progress_user ON user_question_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_progress_next_review ON user_question_progress(next_review_at);
