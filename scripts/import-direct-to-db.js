// Importa o SQL consolidado para Supabase
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function importDirect() {
    console.log('🚀 Importando questões extraídas diretamente...\n');

    const jsonFile = 'all-questions-direct.json';
    if (!fs.existsSync(jsonFile)) {
        console.error('❌ Arquivo não encontrado:', jsonFile);
        return;
    }

    const questions = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    console.log(`📊 ${questions.length} questões para importar\n`);

    let inserted = 0;
    let errors = 0;
    let duplicates = 0;

    // Processar em lotes de 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE).map(q => ({
            institution: q.institution,
            year: q.year,
            area: q.area || 'Todas as áreas',
            subarea: null,
            difficulty: q.dificuldade || 'media',
            question_text: q.texto_questao,
            option_a: q.alternativa_a,
            option_b: q.alternativa_b,
            option_c: q.alternativa_c,
            option_d: q.alternativa_d,
            option_e: q.alternativa_e || null,
            correct_answer: q.gabarito || 'A'
        }));

        const { data, error } = await supabase
            .from('questions')
            .upsert(batch, {
                onConflict: 'question_text',
                ignoreDuplicates: true
            });

        if (error) {
            // Tentar inserir um por um
            for (const q of batch) {
                const { error: singleError } = await supabase
                    .from('questions')
                    .insert(q);

                if (singleError) {
                    if (singleError.message.includes('duplicate')) {
                        duplicates++;
                    } else {
                        errors++;
                    }
                } else {
                    inserted++;
                }
            }
        } else {
            inserted += batch.length;
        }

        process.stdout.write(`\r   Progresso: ${Math.min(i + BATCH_SIZE, questions.length)}/${questions.length}`);
    }

    console.log('\n\n' + '='.repeat(50));
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('='.repeat(50));
    console.log(`✅ Inseridas: ${inserted}`);
    console.log(`⚠️ Duplicadas: ${duplicates}`);
    console.log(`❌ Erros: ${errors}`);

    // Total no banco
    const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true });

    console.log(`\n📈 Total no banco: ${count} questões`);
    console.log('\n🎉 Concluído!');
}

importDirect().catch(console.error);
