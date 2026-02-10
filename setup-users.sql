-- ============================================
-- SETUP: Sistema de Usuários e Onboarding
-- ============================================

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP DEFAULT NOW()
);

-- 2. Tabela de Perfil do Usuário (Respostas do Questionário)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  target_institution TEXT NOT NULL,
  target_specialty TEXT NOT NULL,
  exam_date DATE,
  exam_timeframe TEXT CHECK (exam_timeframe IN ('menos_3_meses', '3_6_meses', '6_12_meses', 'mais_1_ano')),
  weekly_hours INTEGER NOT NULL,
  has_attempted_before BOOLEAN DEFAULT FALSE,
  theoretical_base TEXT CHECK (theoretical_base IN ('fraca', 'media', 'boa', 'excelente')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tabela de Metas Personalizadas
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  daily_hours_goal DECIMAL NOT NULL,
  weekly_hours_goal DECIMAL NOT NULL,
  target_percentage DECIMAL NOT NULL, -- Nota de corte da instituição
  theory_percentage INTEGER, -- % de tempo em teoria
  practice_percentage INTEGER, -- % de tempo em prática
  focus_area TEXT, -- Área principal de foco
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);

-- 5. Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para users
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (true); -- Por enquanto permitir todos (auth será implementado)

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (true);

-- Políticas RLS para user_profiles
CREATE POLICY "Users can view own user_profile" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own user_profile" ON user_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own user_profile" ON user_profiles
  FOR UPDATE USING (true);

-- Políticas RLS para user_goals
CREATE POLICY "Users can view own goals" ON user_goals
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own goals" ON user_goals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own goals" ON user_goals
  FOR UPDATE USING (true);

-- 6. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_goals_updated_at
    BEFORE UPDATE ON user_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Dados de Exemplo (para desenvolvimento)
-- Criar usuário exemplo
INSERT INTO users (id, email, name, onboarding_completed)
VALUES (
  'mock-user-id'::uuid,
  'usuario@exemplo.com',
  'Usuário Exemplo',
  true
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name;

-- Perfil exemplo
INSERT INTO user_profiles (user_id, target_institution, target_specialty, weekly_hours, theoretical_base, exam_timeframe)
VALUES (
  'mock-user-id'::uuid,
  'ENARE',
  'Cirurgia',
  20,
  'boa',
  '3_6_meses'
) ON CONFLICT (user_id) DO UPDATE SET
  target_institution = EXCLUDED.target_institution,
  target_specialty = EXCLUDED.target_specialty;

-- Metas exemplo
INSERT INTO user_goals (user_id, daily_hours_goal, weekly_hours_goal, target_percentage, theory_percentage, practice_percentage, focus_area)
VALUES (
  'mock-user-id'::uuid,
  4.0,
  20.0,
  75.0,
  30,
  70,
  'Cirurgia'
) ON CONFLICT (user_id) DO UPDATE SET
  daily_hours_goal = EXCLUDED.daily_hours_goal,
  weekly_hours_goal = EXCLUDED.weekly_hours_goal;

-- ============================================
-- FIM DO SETUP
-- ============================================
