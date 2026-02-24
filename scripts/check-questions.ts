import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

async function check() {
    // First: get actual column names
    const { rows: cols } = await query(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'questions' ORDER BY ordinal_position
    `);
    console.log('\n=== QUESTIONS TABLE COLUMNS ===');
    cols.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

    // Sample 3 questions with raw SELECT *
    const { rows } = await query(`
        SELECT q.*, d.title as doc_title, d.institution, d.year as doc_year
        FROM questions q
        JOIN documents d ON q.document_id = d.id
        LIMIT 3
    `);

    rows.forEach((q, i) => {
        console.log(`\n━━━ Question ${i + 1} ━━━`);
        console.log(`  Keys: ${Object.keys(q).join(', ')}`);
        console.log(`  Doc: ${q.doc_title} | ${q.institution} | ${q.doc_year}`);
        console.log(`  Stem (150): ${(q.stem || '').substring(0, 150)}`);
        console.log(`  Correct: ${q.correct_option || q.correct_answer || q.answer}`);
        console.log(`  Explanation: ${(q.explanation || '<EMPTY>').substring(0, 100)}`);
    });

    // Stats
    const { rows: [stats] } = await query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN explanation IS NOT NULL AND explanation != '' THEN 1 END) as with_exp
        FROM questions
    `);
    console.log(`\n📊 ${stats.with_exp}/${stats.total} have explanations`);

    process.exit(0);
}
check().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
