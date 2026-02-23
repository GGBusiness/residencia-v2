import { query } from '../lib/db';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function setupAdminSchema() {
    console.log('🛡️ Configurando Schema do Admin...');

    try {
        await query(`
            CREATE TABLE IF NOT EXISTS api_usage_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                provider VARCHAR(50) NOT NULL,
                model VARCHAR(100) NOT NULL,
                tokens_input INTEGER DEFAULT 0,
                tokens_output INTEGER DEFAULT 0,
                cost_usd DECIMAL(10, 6) DEFAULT 0,
                context VARCHAR(255), 
                user_id UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log('✅ Tabela api_usage_logs criada/verificada.');

        // Index para performance em queries de data
        await query(`
            CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_logs(created_at);
        `);
        console.log('✅ Index idx_api_usage_created_at criado.');

    } catch (error) {
        console.error('❌ Erro ao criar schema:', error);
    }
}

setupAdminSchema().then(() => process.exit(0));
