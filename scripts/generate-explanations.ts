/**
 * STEP 2: Generate explanations for all questions using OpenAI GPT-4o-mini
 * 
 * For each question without an explanation, sends stem + options + correct answer
 * to GPT-4o-mini and asks for a medical explanation in Portuguese.
 * 
 * Run: npx tsx scripts/generate-explanations.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env.local');
    process.exit(1);
}

const BATCH_SIZE = 5;
const MODEL = 'gpt-4o-mini';

async function callOpenAI(messages: any[]): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: MODEL,
            messages,
            max_tokens: 500,
            temperature: 0.3,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error: ${res.status} - ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content.trim();
}

async function generateExplanation(q: any): Promise<string> {
    const optionsText = [
        `A) ${q.option_a}`,
        `B) ${q.option_b}`,
        `C) ${q.option_c}`,
        `D) ${q.option_d}`,
        q.option_e ? `E) ${q.option_e}` : null,
    ].filter(Boolean).join('\n');

    const messages = [
        {
            role: 'system',
            content: `Você é um professor de medicina especialista em provas de residência médica (ENARE, USP, UNICAMP).
Sua tarefa é fornecer explicações claras e concisas para questões de múltipla escolha.
Responda SEMPRE em português brasileiro.
Seja direto: explique por que a alternativa correta está certa e por que as principais alternativas erradas estão incorretas.
Limite a explicação a 3-5 frases. Não inclua o enunciado da questão na explicação.`
        },
        {
            role: 'user',
            content: `ENUNCIADO: ${q.stem}

ALTERNATIVAS:
${optionsText}

GABARITO: ${q.correct_option}

Explique por que a alternativa ${q.correct_option} é correta e por que as outras estão erradas.`
        }
    ];

    return callOpenAI(messages);
}

async function main() {
    console.log('\n══════════════════════════════════════════');
    console.log('  STEP 2: GERANDO EXPLICAÇÕES VIA GPT-4o-mini');
    console.log('══════════════════════════════════════════\n');

    // Get questions without explanations
    const { rows: questions } = await query(`
        SELECT id, stem, option_a, option_b, option_c, option_d, option_e, correct_option, area
        FROM questions
        WHERE explanation IS NULL OR explanation = ''
        ORDER BY created_at
    `);

    console.log(`📋 Questões sem explicação: ${questions.length}`);

    if (questions.length === 0) {
        console.log('✅ Todas as questões já têm explicação!');
        process.exit(0);
    }

    let generated = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(questions.length / BATCH_SIZE)} (questões ${i + 1}-${Math.min(i + BATCH_SIZE, questions.length)})`);

        // Process batch concurrently
        const promises = batch.map(async (q) => {
            try {
                const explanation = await generateExplanation(q);
                await query('UPDATE questions SET explanation = $1 WHERE id = $2', [explanation, q.id]);
                generated++;
                return { id: q.id, success: true };
            } catch (e: any) {
                console.error(`  ❌ Questão ${q.id}: ${e.message.substring(0, 80)}`);
                errors++;
                return { id: q.id, success: false };
            }
        });

        const results = await Promise.all(promises);
        const batchSuccess = results.filter(r => r.success).length;
        console.log(`  ✅ ${batchSuccess}/${batch.length} geradas`);

        // Rate limit: wait 1s between batches
        if (i + BATCH_SIZE < questions.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    console.log('\n══════════════════════════════════════════');
    console.log(`  RESULTADO: ${generated} geradas, ${errors} erros`);
    console.log('══════════════════════════════════════════\n');

    // Verify
    const { rows: [{ count }] } = await query(`SELECT COUNT(*) as count FROM questions WHERE explanation IS NOT NULL AND explanation != ''`);
    console.log(`📊 Questões com explicação agora: ${count}/474`);

    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
