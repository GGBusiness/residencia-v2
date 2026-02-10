import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import OpenAI from 'openai';

async function test() {
    console.log('🔑 Testando chave OpenAI...');

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
        console.error('❌ ERRO: OPENAI_API_KEY não encontrada nas variáveis de ambiente.');
        return;
    }

    console.log(`ℹ️  Chave encontrada: ${key.substring(0, 8)}...${key.substring(key.length - 4)}`);

    const openai = new OpenAI({ apiKey: key });

    try {
        const response = await openai.models.list();
        console.log('✅ Sucesso! Conexão estabelecida.');
        console.log('📋 Modelos disponíveis:', response.data.slice(0, 3).map(m => m.id));
    } catch (error: any) {
        console.error('❌ Falha na conexão:', error.message);
        if (error.response) {
            console.error('Detalhes:', error.response.data);
        }
    }
}

test();
