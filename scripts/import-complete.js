// Importa questões do arquivo completo para Supabase
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function importAll() {
    console.log('🚀 Importando questões completas...\n');

    const questions = JSON.parse(fs.readFileSync('all-questions-complete.json', 'utf-8'));
    console.log(`📊 ${questions.length} questões para importar\n`);

    let inserted = 0, errors = 0, duplicates = 0;

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        const { error } = await supabase.from('questions').insert({
            institution: q.institution || 'ENARE',
            year: q.year || 2024,
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
        });

        if (error) {
            if (error.message.includes('duplicate')) duplicates++;
            else errors++;
        } else {
            inserted++;
        }

        if ((i + 1) % 100 === 0) {
            process.stdout.write(`\r   ${i + 1}/${questions.length} (${inserted} novas)`);
        }
    }

    console.log(`\n\n${'='.repeat(50)}`);
    console.log(`✅ Inseridas: ${inserted}`);
    console.log(`⚠️ Duplicadas: ${duplicates}`);
    console.log(`❌ Erros: ${errors}`);

    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true });
    console.log(`\n📈 Total no banco: ${count} questões`);
}

importAll().catch(console.error);
