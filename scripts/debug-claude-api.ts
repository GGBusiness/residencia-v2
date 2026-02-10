import fs from 'fs';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

console.log('🔑 Chave API (primeiros 20 chars):', ANTHROPIC_API_KEY?.substring(0, 20) + '...');

if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY não configurada!');
    process.exit(1);
}

// Teste simples sem PDF
const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [{
        role: 'user',
        content: 'Diga apenas "Olá, funcionou!" em português.'
    }]
});

console.log('\n📡 Enviando requisição de teste para Claude API...\n');

const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload)
    }
};

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📊 Status Code:', res.statusCode);
        console.log('📄 Resposta completa:');

        try {
            const result = JSON.parse(data);
            console.log(JSON.stringify(result, null, 2));

            if (res.statusCode === 200) {
                console.log('\n✅ API funcionando! Resposta:', result.content?.[0]?.text);
            } else {
                console.log('\n❌ Erro na API:', result.error?.message || 'Desconhecido');
            }
        } catch (e) {
            console.log('Resposta raw:', data);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ Erro na requisição:', e.message);
});

req.write(payload);
req.end();
