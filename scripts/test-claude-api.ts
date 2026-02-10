import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

console.log('🔍 Testando Claude API...\n');

if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY não encontrada no .env.local');
    process.exit(1);
}

console.log(`✅ API Key encontrada: ${ANTHROPIC_API_KEY.substring(0, 20)}...`);
console.log(`📏 Tamanho da chave: ${ANTHROPIC_API_KEY.length} caracteres\n`);

async function testAPI() {
    try {
        console.log('📡 Enviando requisição de teste...\n');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 100,
                messages: [{
                    role: 'user',
                    content: 'Responda apenas "OK" se você está funcionando.'
                }]
            })
        });

        console.log(`📊 Status HTTP: ${response.status}\n`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Erro na API:\n');
            console.error(errorText);
            console.error('\n📌 DIAGNÓSTICO:\n');

            if (errorText.includes('credit balance')) {
                console.error('💳 Problema: Créditos insuficientes ou não processados');
                console.error('🔗 Acesse: https://console.anthropic.com/settings/billing');
                console.error('✅ Verifique:');
                console.error('   1. Se os créditos aparecem no saldo');
                console.error('   2. Se o pagamento foi processado');
                console.error('   3. Aguarde 5-10 minutos se acabou de adicionar\n');
            } else if (errorText.includes('api key')) {
                console.error('🔑 Problema: API Key inválida');
                console.error('🔗 Acesse: https://console.anthropic.com/settings/keys');
                console.error('✅ Gere uma NOVA chave e substitua no .env.local\n');
            }

            process.exit(1);
        }

        const result = await response.json();
        console.log('✅ API FUNCIONANDO!\n');
        console.log('📝 Resposta do Claude:');
        console.log(result.content[0].text);
        console.log('\n🎉 Tudo certo! Pode processar PDFs agora!\n');

    } catch (error: any) {
        console.error('\n❌ Erro ao conectar:', error.message);
        process.exit(1);
    }
}

testAPI();
