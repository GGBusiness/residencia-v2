
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });

// Configuração do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: Variáveis de ambiente do Supabase não encontradas!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
    console.log('🚀 Iniciando importação direta para o Supabase (v2 - Extração Avançada)...');

    const jsonPath = path.join(process.cwd(), 'meus_uploads', 'enare_completo.json');

    if (!fs.existsSync(jsonPath)) {
        console.error(`❌ Arquivo não encontrado: ${jsonPath}`);
        process.exit(1);
    }

    console.log('📂 Lendo arquivo JSON...');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    let questions: any[] = JSON.parse(rawData);

    if (!Array.isArray(questions) && (questions as any).questions) {
        questions = (questions as any).questions;
    }

    if (!Array.isArray(questions)) {
        console.error('❌ Formato de JSON inválido. Esperado um array de questões.');
        process.exit(1);
    }

    console.log(`📊 Total de questões no JSON: ${questions.length}`);

    // Mapeamento e Limpeza
    const formattedQuestions = questions.map((q, index) => {
        let explanation = null;
        let correctAnswer = null;

        // Função para processar texto da alternativa
        // Remove "Gabarito: X" e "COMENTÁRIO: ..." e extrai esses dados
        const processText = (text: string) => {
            if (!text || typeof text !== 'string') return text;

            // 1. Tentar extrair Gabarito se estiver no formato "Gabarito: A"
            const gabaritoMatch = text.match(/Gabarito:\s*([A-E])/i);
            if (gabaritoMatch) {
                correctAnswer = gabaritoMatch[1].toUpperCase();
            }

            // 2. Tentar extrair Comentário se estiver no formato "\nCOMENTÁRIO: ..."
            // Às vezes o comentário vem antes ou depois do gabarito.
            const commentMatch = text.match(/\nCOMENTÁRIO:([\s\S]*)/i);
            if (commentMatch) {
                // Se já tem explicação capturada de outra alternativa (raro), concatena ou mantém?
                // Geralmente só a última alternativa tem o comentário.
                explanation = commentMatch[1].trim();

                // Remover o comentário do texto
                text = text.replace(/\nCOMENTÁRIO:[\s\S]*/i, '').trim();
            }

            // 3. Remover "Gabarito: X" se sobrou no texto
            text = text.replace(/Gabarito:\s*[A-E][\s\S]*/i, '').trim(); // Remove gabarito e o que vier depois (se for lixo)

            // Limpezas extras de quebras de linha no final ou inicio
            return text.trim();
        };

        const rawAlts = [
            q.alternativa_a,
            q.alternativa_b,
            q.alternativa_c,
            q.alternativa_d,
            q.alternativa_e
        ];

        // Filtra nulos e processa cada um
        const alts = rawAlts
            .filter(a => a && typeof a === 'string' && a.trim() !== '')
            .map(a => processText(a));

        // Fallback para correct_answer se não achou nas alternativas
        if (!correctAnswer) {
            correctAnswer = q.gabarito || q.resposta || q.resposta_correta;
        }

        // Fallback final: procurar no texto da questão
        if (!correctAnswer && q.texto_questao) {
            const gabaritoMatch = q.texto_questao.match(/Gabarito:\s*([A-E])/i);
            if (gabaritoMatch) {
                correctAnswer = gabaritoMatch[1].toUpperCase();
            }
        }

        // Mapeamento para nomes do banco (snake_case)
        // Table schema: institution, year, area, subarea, difficulty, question_text, alternatives (ARRAY??)
        // WAIT! The table schema in setup-questions-final.sql shows:
        // option_a, option_b, option_c, option_d, option_e TEXT
        // It DOES NOT have an 'alternatives' array column!
        // It has separate columns for options!

        // I need to map alts array to option_a, option_b...

        return {
            institution: q.prova || q.exam_name || 'ENARE',
            year: parseInt(q.ano || q.year || '2024'),
            area: q.area || q.specialty || 'Geral',
            subarea: q.subarea || q.sub_specialty || null,
            difficulty: q.dificuldade || q.difficulty || 'media',
            question_text: q.texto_questao || q.enunciado || q.text,

            option_a: alts[0] || '',
            option_b: alts[1] || '',
            option_c: alts[2] || '',
            option_d: alts[3] || '',
            option_e: alts[4] || null, // option_e pode ser null

            correct_answer: correctAnswer,
            explanation: explanation
        };
    });

    // Validar
    const validQuestions = formattedQuestions.filter((q, i) => {
        const hasText = !!q.question_text;
        const hasOptions = !!q.option_a && !!q.option_b; // Pelo menos 2 opções
        const hasCorrect = !!q.correct_answer && ['A', 'B', 'C', 'D', 'E'].includes(q.correct_answer);

        const isValid = hasText && hasOptions && hasCorrect;

        if (!isValid && i < 5) {
            console.log(`⚠️ Item ${i} inválido:`, {
                hasText,
                hasOptions,
                hasCorrect,
                correct_answer: q.correct_answer
            });
        }
        return isValid;
    });

    console.log(`✅ Questões válidas para inserção: ${validQuestions.length}`);

    if (validQuestions.length === 0) {
        console.error('❌ Nenhuma questão válida encontrada. Verifique os logs acima.');
        return;
    }

    // Inserir
    const CHUNK_SIZE = 50;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < validQuestions.length; i += CHUNK_SIZE) {
        const chunk = validQuestions.slice(i, i + CHUNK_SIZE);

        try {
            const { error } = await supabase.from('questions').insert(chunk);

            if (error) {
                console.error(`❌ Erro no lote ${i}:`, error.message);
                errorCount += chunk.length;
            } else {
                successCount += chunk.length;
                process.stdout.write(`\r✅ Progresso: ${successCount} / ${validQuestions.length} questões importadas...`);
            }
        } catch (err) {
            console.error(`❌ Erro inesperado no lote ${i}:`, err);
            errorCount += chunk.length;
        }

        await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n\n🏁 Importação finalizada!');
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Falhas: ${errorCount}`);
}

main().catch(console.error);
