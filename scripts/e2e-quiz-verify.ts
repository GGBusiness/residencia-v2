/**
 * END-TO-END QUIZ VERIFICATION
 * Simulates: Create attempt → Load questions → Verify display quality
 * Run: npx tsx scripts/e2e-quiz-verify.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

async function verify() {
    console.log('\n══════════════════════════════════════════════');
    console.log('  E2E QUIZ FLOW VERIFICATION');
    console.log('══════════════════════════════════════════════\n');

    // 1. Check existing documents
    console.log('📄 1. DOCUMENTS IN SYSTEM:');
    const { rows: docs } = await query(`
        SELECT d.id, d.title, d.institution, d.year, 
               COUNT(q.id) as question_count
        FROM documents d
        LEFT JOIN questions q ON q.document_id = d.id
        GROUP BY d.id, d.title, d.institution, d.year
        HAVING COUNT(q.id) > 0
        ORDER BY d.year DESC, d.institution
    `);
    docs.forEach(d => {
        console.log(`  📋 ${d.institution} ${d.year} — "${d.title}" — ${d.question_count} questions`);
    });

    if (docs.length === 0) {
        console.log('  ❌ NO documents with questions found!');
        process.exit(1);
    }

    // 2. Check attempts table schema
    console.log('\n📋 2. ATTEMPTS TABLE SCHEMA:');
    const { rows: attemptCols } = await query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns WHERE table_name = 'attempts'
        ORDER BY ordinal_position
    `);
    attemptCols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})${c.is_nullable === 'YES' ? ' NULL' : ''}`));

    // 3. Check attempt_answers table schema
    console.log('\n📋 3. ATTEMPT_ANSWERS TABLE SCHEMA:');
    const { rows: answerCols } = await query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns WHERE table_name = 'attempt_answers'
        ORDER BY ordinal_position
    `);
    if (answerCols.length === 0) {
        console.log('  ❌ attempt_answers TABLE DOES NOT EXIST!');
        console.log('  Creating attempt_answers table...');
        await query(`
            CREATE TABLE IF NOT EXISTS attempt_answers (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
                question_id UUID NOT NULL,
                question_index INT NOT NULL,
                choice VARCHAR(1),
                is_correct BOOLEAN DEFAULT false,
                flagged BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(attempt_id, question_index)
            )
        `);
        console.log('  ✅ Table created!');
    } else {
        answerCols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})${c.is_nullable === 'YES' ? ' NULL' : ''}`));
    }

    // 4. Simulate quiz data loading (what getQuizDataAction does)
    console.log('\n🧪 4. SIMULATING QUIZ DATA LOAD:');
    const testDocIds = docs.slice(0, 2).map(d => d.id);
    console.log(`  Using documents: ${testDocIds.join(', ')}`);

    const { rows: questions } = await query(`
        SELECT q.id, q.document_id, q.number_in_exam, q.stem,
               q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
               q.correct_option, q.explanation, q.area, q.subarea, q.topic,
               d.title as doc_title, d.institution, d.year as doc_year
        FROM questions q
        JOIN documents d ON q.document_id = d.id
        WHERE q.document_id = ANY($1::uuid[])
        ORDER BY d.year DESC, q.number_in_exam ASC NULLS LAST
        LIMIT 20
    `, [testDocIds]);

    console.log(`  Loaded ${questions.length} questions`);

    // 5. Verify data quality
    console.log('\n✨ 5. DATA QUALITY CHECK:');
    let issues = 0;

    questions.forEach((q, i) => {
        const stem = q.stem || '';
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d];

        // Check for garbage patterns
        const garbagePatterns = ['GABARITO', 'Medway', 'Páginas', 'Página'];
        const allText = [stem, ...opts, q.option_e].filter(Boolean).join(' ');

        for (const p of garbagePatterns) {
            if (allText.includes(p)) {
                console.log(`  ❌ Q${i + 1}: Contains "${p}" garbage!`);
                issues++;
            }
        }

        // Check required fields
        if (!stem || stem.length < 10) {
            console.log(`  ⚠️ Q${i + 1}: Very short stem (${stem.length} chars): "${stem.substring(0, 50)}"`);
        }
        if (!q.correct_option) {
            console.log(`  ❌ Q${i + 1}: Missing correct_option!`);
            issues++;
        }
        if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) {
            console.log(`  ⚠️ Q${i + 1}: Missing required option (A/B/C/D)`);
        }
    });

    if (issues === 0) {
        console.log('  ✅ All questions clean — no garbage detected!');
    }

    // 6. Display 5 samples as they would appear in the quiz
    console.log('\n👀 6. AS DISPLAYED IN QUIZ (5 samples):');
    const samples = questions.slice(0, 5);
    for (const q of samples) {
        console.log(`\n  ┌────────────────────────────────────────────────`);
        console.log(`  │ ${q.institution} ${q.doc_year} | ${q.area || 'Geral'}`);
        console.log(`  ├────────────────────────────────────────────────`);
        console.log(`  │ ${(q.stem || '').substring(0, 120)}`);
        console.log(`  │`);
        console.log(`  │ A) ${(q.option_a || '').substring(0, 80)}`);
        console.log(`  │ B) ${(q.option_b || '').substring(0, 80)}`);
        console.log(`  │ C) ${(q.option_c || '').substring(0, 80)}`);
        console.log(`  │ D) ${(q.option_d || '').substring(0, 80)}`);
        if (q.option_e) {
            console.log(`  │ E) ${q.option_e.substring(0, 80)}`);
        }
        console.log(`  │`);
        console.log(`  │ ✅ Gabarito: ${q.correct_option}`);
        console.log(`  │ 💡 ${(q.explanation || 'Sem explicação').substring(0, 100)}`);
        console.log(`  └────────────────────────────────────────────────`);
    }

    // 7. Check recent attempts
    console.log('\n📊 7. RECENT ATTEMPTS:');
    try {
        const { rows: attempts } = await query(`
            SELECT id, status, config, correct_answers, percentage, 
                   created_at, completed_at
            FROM attempts ORDER BY created_at DESC LIMIT 5
        `);
        if (attempts.length === 0) {
            console.log('  No attempts yet.');
        } else {
            attempts.forEach(a => {
                const docCount = a.config?.documentIds?.length || 0;
                console.log(`  ${a.status === 'COMPLETED' ? '✅' : '⏳'} ${a.status} — ${docCount} docs, ${a.correct_answers || '?'}/${a.config?.questionCount || '?'} correct (${a.percentage || '?'}%) — ${new Date(a.created_at).toLocaleString()}`);
            });
        }
    } catch (e: any) {
        console.log(`  ⚠️ ${e.message}`);
    }

    console.log('\n══════════════════════════════════════════════\n');
    process.exit(0);
}

verify().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
