-- ========================================
-- SISTEMA DE IA E RASTREAMENTO DE PERFORMANCE
-- Tabelas para algoritmo de recomendação personalizada
-- ========================================

-- 1. Rastreamento detalhado de cada resposta
CREATE TABLE IF NOT EXISTS user_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    attempt_id UUID REFERENCES attempts(id) ON DELETE CASCADE,
    
    -- Resposta
    user_answer VARCHAR(1), -- A, B, C, D, E
    correct BOOLEAN NOT NULL,
    time_spent_seconds INT,
    
    -- Metadados para análise
    area VARCHAR NOT NULL,
    subarea VARCHAR,
    difficulty VARCHAR,
    institution VARCHAR,
    year INT,
    
    -- Timestamps
    answered_at TIMESTAMP DEFAULT NOW(),
    
    -- Índices
    CONSTRAINT unique_user_question_attempt UNIQUE(user_id, question_id, attempt_id)
);

CREATE INDEX idx_performance_user ON user_performance(user_id);
CREATE INDEX idx_performance_area ON user_performance(user_id, area);
CREATE INDEX idx_performance_correct ON user_performance(user_id, correct);
CREATE INDEX idx_performance_date ON user_performance(answered_at);

-- 2. Perfil agregado de conhecimento por área
CREATE TABLE IF NOT EXISTS user_knowledge_profile (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    area VARCHAR NOT NULL,
    
    -- Estatísticas gerais
    total_answered INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    wrong_count INT DEFAULT 0,
    accuracy_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_answered > 0 
            THEN (correct_count::DECIMAL / total_answered::DECIMAL * 100)
            ELSE 0 
        END
    ) STORED,
    
    -- Análise de tendências
    last_10_accuracy DECIMAL(5,2), -- Últimas 10 questões
    trend VARCHAR(20), -- 'improving', 'declining', 'stable'
    
    -- Priorização para recomendação
    priority_level INT, -- 1=crítico (<60%), 2=atenção (60-75%), 3=bom (75-85%), 4=excelente (>85%)
    recommended_questions_count INT DEFAULT 20, -- Quantas questões recomendar
    
    -- Timestamps
    last_practiced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, area)
);

CREATE INDEX idx_profile_user_area ON user_knowledge_profile(user_id, area);
CREATE INDEX idx_profile_priority ON user_knowledge_profile(priority_level);

-- 3. Histórico de evolução (para gráficos)
CREATE TABLE IF NOT EXISTS user_evolution_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Métricas globais do dia
    questions_answered INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    accuracy DECIMAL(5,2),
    total_study_time_minutes INT DEFAULT 0,
    
    -- Por área (JSON)
    area_breakdown JSONB, -- { "Cirurgia": { "answered": 10, "correct": 7 }, ... }
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

CREATE INDEX idx_evolution_user_date ON user_evolution_history(user_id, date DESC);

-- 4. Questões já respondidas (para não repetir)
CREATE TABLE IF NOT EXISTS user_answered_questions (
    user_id UUID NOT NULL,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    times_answered INT DEFAULT 1,
    last_answered_at TIMESTAMP DEFAULT NOW(),
    
    PRIMARY KEY (user_id, question_id)
);

CREATE INDEX idx_answered_user ON user_answered_questions(user_id);

-- 5. Recomendações geradas (cache)
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    
    -- Questões recomendadas
    question_ids UUID[] NOT NULL,
    
    -- Razão da recomendação
    reasoning JSONB, -- { "weak_areas": ["Cirurgia"], "recommended_count": 20, ... }
    
    -- Status
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_recommendations_user ON ai_recommendations(user_id, created_at DESC);

-- ===========================================
-- FUNÇÕES ÚTEIS
-- ===========================================

-- Atualizar perfil após cada questão respondida
CREATE OR REPLACE FUNCTION update_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Inserir ou atualizar perfil da área
    INSERT INTO user_knowledge_profile (user_id, area, total_answered, correct_count, wrong_count, last_practiced_at)
    VALUES (
        NEW.user_id,
        NEW.area,
        1,
        CASE WHEN NEW.correct THEN 1 ELSE 0 END,
        CASE WHEN NOT NEW.correct THEN 1 ELSE 0 END,
        NEW.answered_at
    )
    ON CONFLICT (user_id, area)
    DO UPDATE SET
        total_answered = user_knowledge_profile.total_answered + 1,
        correct_count = user_knowledge_profile.correct_count + CASE WHEN NEW.correct THEN 1 ELSE 0 END,
        wrong_count = user_knowledge_profile.wrong_count + CASE WHEN NOT NEW.correct THEN 1 ELSE 0 END,
        last_practiced_at = NEW.answered_at,
        updated_at = NOW(),
        priority_level = CASE
            WHEN ((user_knowledge_profile.correct_count + CASE WHEN NEW.correct THEN 1 ELSE 0 END)::DECIMAL / 
                  (user_knowledge_profile.total_answered + 1)::DECIMAL * 100) < 60 THEN 1
            WHEN ((user_knowledge_profile.correct_count + CASE WHEN NEW.correct THEN 1 ELSE 0 END)::DECIMAL / 
                  (user_knowledge_profile.total_answered + 1)::DECIMAL * 100) < 75 THEN 2
            WHEN ((user_knowledge_profile.correct_count + CASE WHEN NEW.correct THEN 1 ELSE 0 END)::DECIMAL / 
                  (user_knowledge_profile.total_answered + 1)::DECIMAL * 100) < 85 THEN 3
            ELSE 4
        END;
    
    -- Atualizar questões respondidas
    INSERT INTO user_answered_questions (user_id, question_id, times_answered, last_answered_at)
    VALUES (NEW.user_id, NEW.question_id, 1, NEW.answered_at)
    ON CONFLICT (user_id, question_id)
    DO UPDATE SET
        times_answered = user_answered_questions.times_answered + 1,
        last_answered_at = NEW.answered_at;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar perfil automaticamente
DROP TRIGGER IF EXISTS trigger_update_profile ON user_performance;
CREATE TRIGGER trigger_update_profile
AFTER INSERT ON user_performance
FOR EACH ROW
EXECUTE FUNCTION update_user_profile();

-- Função para calcular tendência
CREATE OR REPLACE FUNCTION calculate_trend(p_user_id UUID, p_area VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    last_10_perf DECIMAL;
    overall_perf DECIMAL;
BEGIN
    -- Calcular performance das últimas 10 questões
    SELECT 
        (SUM(CASE WHEN correct THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)::DECIMAL * 100)
    INTO last_10_perf
    FROM (
        SELECT correct
        FROM user_performance
        WHERE user_id = p_user_id AND area = p_area
        ORDER BY answered_at DESC
        LIMIT 10
    ) recent;
    
    -- Performance geral
    SELECT accuracy_percentage INTO overall_perf
    FROM user_knowledge_profile
    WHERE user_id = p_user_id AND area = p_area;
    
    -- Determinar tendência
    IF last_10_perf > overall_perf + 5 THEN
        RETURN 'improving';
    ELSIF last_10_perf < overall_perf - 5 THEN
        RETURN 'declining';
    ELSE
        RETURN 'stable';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- CONSULTAS ÚTEIS
-- ===========================================

-- Ver perfil do usuário
-- SELECT * FROM user_knowledge_profile WHERE user_id = 'uuid' ORDER BY priority_level, accuracy_percentage;

-- Ver evolução ao longo do tempo
-- SELECT * FROM user_evolution_history WHERE user_id =  'uuid' ORDER BY date DESC LIMIT 30;

-- Ver questões já respondidas
-- SELECT COUNT(*) as total_unique_questions FROM user_answered_questions WHERE user_id = 'uuid';

-- Ver performance recente
-- SELECT * FROM user_performance WHERE user_id = 'uuid' ORDER BY answered_at DESC LIMIT 20;

-- ===========================================
-- POLICIES (RLS) - DESCOMENTE QUANDO AUTH ESTIVER PRONTO
-- ===========================================

-- ALTER TABLE user_performance ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can only see their own performance" ON user_performance FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert their own performance" ON user_performance FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ALTER TABLE user_knowledge_profile ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can only see their own profile" ON user_knowledge_profile FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE user_performance IS 'Rastreamento detalhado de cada questão respondida para análise e IA';
COMMENT ON TABLE user_knowledge_profile IS 'Perfil agregado de conhecimento do usuário por área médica';
COMMENT ON TABLE user_evolution_history IS 'Histórico de evolução diária para gráficos de progresso';
COMMENT ON TABLE ai_recommendations IS 'Cache de recomendações geradas pela IA para otimizar performance';
