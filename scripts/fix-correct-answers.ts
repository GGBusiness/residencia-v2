/**
 * FIX CORRECT ANSWERS — Uses GPT-4o-mini to determine correct answers
 * for questions that were incorrectly defaulted to 'A' during extraction.
 * 
 * Run: npx tsx scripts/fix-correct-answers.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH_SIZE = 10;
const DELAY_MS = 500;

interface QuestionRow {
    id: string;
    stem: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    option_e: string | null;
    correct_option: string;
    area: string;
}

async function determineCorrectAnswer(q: QuestionRow): Promise<string | null> {
    const optionsText = [
        `A) ${q.option_a}`,
        `B) ${q.option_b}`,
        `C) ${q.option_c}`,
        `D) ${q.option_d}`,
        q.option_e ? `E) ${q.option_e}` : null,
    ].filter(Boolean).join('\n');

    const prompt = `Você é um médico especialista em provas de residência médica brasileira.

Analise esta questão e determine qual é a alternativa CORRETA. Responda APENAS com a letra (A, B, C, D ou E).

QUESTÃO:
${q.stem}

ALTERNATIVAS:
${optionsText}

Responda APENAS a letra da alternativa correta (A, B, C, D ou E):`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 5,
            temperature: 0,
        });

        const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
        // Validate it's a valid letter
        if (answer && ['A', 'B', 'C', 'D', 'E'].includes(answer.charAt(0))) {
            return answer.charAt(0);
        }
        return null;
    } catch (error: any) {
        console.error(`  ❌ GPT error for question ${q.id.substring(0, 8)}:`, error.message);
        return null;
    }
}

async function main() {
    console.log('\n══════════════════════════════════════════');
    console.log('  🔧 FIX CORRECT ANSWERS — GPT-4o-mini');
    console.log('══════════════════════════════════════════\n');

    // Get all questions (focus on ones with correct_option = 'A' since those are suspicious)
    const { rows: questions } = await query(`
        SELECT id, stem, option_a, option_b, option_c, option_d, option_e,
               correct_option, area
        FROM questions
        ORDER BY id
    `);

    console.log(`📋 Total questions: ${questions.length}`);

    // Distribution before
    const beforeDist: Record<string, number> = {};
    questions.forEach(q => {
        beforeDist[q.correct_option] = (beforeDist[q.correct_option] || 0) + 1;
    });
    console.log('📊 BEFORE distribution:', JSON.stringify(beforeDist));

    let updated = 0;
    let errors = 0;
    let unchanged = 0;
    const newDist: Record<string, number> = {};

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        console.log(`\n⏳ Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(questions.length / BATCH_SIZE)} (questions ${i + 1}-${Math.min(i + BATCH_SIZE, questions.length)})...`);

        const results = await Promise.all(batch.map(q => determineCorrectAnswer(q)));

        for (let j = 0; j < batch.length; j++) {
            const q = batch[j];
            const newAnswer = results[j];

            if (!newAnswer) {
                errors++;
                newDist[q.correct_option] = (newDist[q.correct_option] || 0) + 1;
                continue;
            }

            newDist[newAnswer] = (newDist[newAnswer] || 0) + 1;

            if (newAnswer !== q.correct_option) {
                await query('UPDATE questions SET correct_option = $1 WHERE id = $2', [newAnswer, q.id]);
                updated++;
                console.log(`  ✅ Q${i + j + 1} (${q.id.substring(0, 8)}): ${q.correct_option} → ${newAnswer}`);
            } else {
                unchanged++;
            }
        }

        // Rate limit delay
        if (i + BATCH_SIZE < questions.length) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }

    console.log('\n══════════════════════════════════════════');
    console.log('  📊 RESULTS');
    console.log('══════════════════════════════════════════');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏸️  Unchanged: ${unchanged}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📊 NEW distribution: ${JSON.stringify(newDist)}`);
    console.log('══════════════════════════════════════════\n');

    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
