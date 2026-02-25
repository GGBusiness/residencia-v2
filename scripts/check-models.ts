import OpenAI from 'openai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * Verifica quais modelos GPT estão disponíveis na sua API key.
 * Mostra os mais potentes primeiro.
 */
async function checkModels() {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    console.log('\n🔍 === MODELOS DISPONÍVEIS NA SUA API KEY ===\n');

    try {
        const models = await openai.models.list();

        // Filtrar modelos GPT/text relevantes
        const gptModels = models.data
            .filter(m => m.id.includes('gpt') || m.id.includes('text-embedding'))
            .map(m => m.id)
            .sort()
            .reverse(); // Mais recentes primeiro

        const priority = ['gpt-5.2', 'gpt-5', 'gpt-4.5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5'];

        console.log('📋 Modelos GPT disponíveis:');
        for (const model of gptModels) {
            const isPriority = priority.some(p => model.startsWith(p));
            const icon = isPriority ? '⭐' : '  ';
            console.log(`  ${icon} ${model}`);
        }

        // Verificar modelos prioritários
        console.log('\n🏆 RECOMENDAÇÃO para o App:');
        let bestModel = 'gpt-4o'; // fallback

        for (const candidate of priority) {
            const found = gptModels.find(m => m.startsWith(candidate));
            if (found) {
                bestModel = found;
                break;
            }
        }

        console.log(`   → Modelo mais potente disponível: ${bestModel}`);
        console.log(`\n💡 Para usar este modelo no app, adicione ao .env.local:`);
        console.log(`   GPT_MODEL=${bestModel}\n`);

        // Testar o modelo
        console.log(`🧪 Testando ${bestModel}...`);
        const test = await openai.chat.completions.create({
            model: bestModel,
            messages: [{ role: 'user', content: 'Responda apenas: OK' }],
            max_tokens: 5,
        });
        console.log(`   ✅ ${bestModel} funcionando! Resposta: "${test.choices[0].message.content}"`);

    } catch (e: any) {
        console.error('❌ Erro:', e.message);
    }

    process.exit(0);
}

checkModels();
