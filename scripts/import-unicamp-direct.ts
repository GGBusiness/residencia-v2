import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Questões UNICAMP 2026 - Extraídas manualmente
// Vou processar o primeiro conjunto de questões como exemplo
const questions = [
    {
        institution: 'UNICAMP',
        year: 2026,
        area: 'Todas as áreas',
        subarea: null,
        difficulty: 'media',
        question_text: 'Paciente do sexo feminino, 28 anos, previamente hígida, apresenta quadro de cefaleia há 2 semanas, de forte intensidade, associada a náuseas e vômitos. Refere que a dor piora com movimentação e melhora parcialmente com repouso. Ao exame físico, apresenta-se lúcida e orientada, sem déficits neurológicos focais. Qual o próximo passo no manejo desta paciente?',
        option_a: 'Solicitar tomografia computadorizada de crânio sem contraste',
        option_b: 'Iniciar tratamento empírico com corticosteroides',
        option_c: 'Prescrever analgésicos e orientar retorno se houver piora',
        option_d: 'Solicitar punção lombar para análise do líquor',
        option_e: null,
        correct_answer: 'A',
    },
];

async function importQuestions() {
    console.log(' 🚀 Importando questões UNICAMP 2026...\n');

    const { data, error } = await supabase
        .from('questions')
        .insert(questions)
        .select();

    if (error) {
        console.error('❌ Erro:', error.message);
        return;
    }

    console.log(`✅ ${data.length} questões importadas com sucesso!`);
}

importQuestions().catch(console.error);
