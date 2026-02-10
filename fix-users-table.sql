-- Verificar estrutura da tabela users
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Se a coluna last_login não existir, adicione:
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP DEFAULT NOW();

-- Se a tabela não existir ou estiver incompleta, crie/recrie:
DROP TABLE IF EXISTS user_goals CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT,
    name TEXT NOT NULL,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    target_institution TEXT NOT NULL,
    target_specialty TEXT NOT NULL,
    exam_date TEXT,
    exam_timeframe TEXT NOT NULL,
    weekly_hours INTEGER NOT NULL,
    has_attempted_before BOOLEAN DEFAULT FALSE,
    theoretical_base TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    daily_hours_goal DECIMAL(4,1) NOT NULL,
    weekly_hours_goal DECIMAL(4,1) NOT NULL,
    target_percentage DECIMAL(5,2) NOT NULL,
    theory_percentage INTEGER NOT NULL,
    practice_percentage INTEGER NOT NULL,
    focus_area TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Desabilitar RLS (para desenvolvimento)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals DISABLE ROW LEVEL SECURITY;
