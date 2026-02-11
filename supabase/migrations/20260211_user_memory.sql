-- Tabela de Configuração e Memória do Usuário para IA
CREATE TABLE IF NOT EXISTS user_memory (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    memory_text TEXT NOT NULL, -- O fato/observação (ex: "Usuário prefere respostas curtas")
    category VARCHAR(50) DEFAULT 'general', -- 'learning_style', 'weakness', 'strength', 'goal'
    tags TEXT[], -- ['cardiologia', 'pediatria', 'resumo']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_category ON user_memory(category);

-- Habilitar RLS (Row Level Security)
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

-- Política: Usuário só vê suas próprias memórias
CREATE POLICY "Users can view own memories" ON user_memory
    FOR SELECT USING (auth.uid() = user_id);

-- Política: Usuário (ou IA agindo por ele) pode inserir
CREATE POLICY "Users can insert own memories" ON user_memory
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política: Usuário pode atualizar
CREATE POLICY "Users can update own memories" ON user_memory
    FOR UPDATE USING (auth.uid() = user_id);

-- Tabela de Logs de Chat (opcional, para histórico curto)
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    message_user TEXT,
    message_ai TEXT,
    context_used TEXT, -- O que a IA sabia na hora (snapshot)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat logs" ON chat_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat logs" ON chat_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);
