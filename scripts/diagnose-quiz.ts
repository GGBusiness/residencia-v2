/**
 * Diagnose quiz issues: question count, correct_option distribution, document linkage
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

async function diagnose() {
    console.log('\n🔍 QUIZ DIAGNOSTICS\n');

    // 1. Correct option distribution
    console.log('📊 1. CORRECT OPTION DISTRIBUTION:');
    const { rows: dist } = await query(`
        SELECT correct_option, COUNT(*) as count 
        FROM questions 
        GROUP BY correct_option 
        ORDER BY correct_option
    `);
    dist.forEach(r => console.log(`   ${r.correct_option}: ${r.count} questions`));

    // 2. Documents with questions
    console.log('\n📄 2. DOCUMENTS WITH QUESTIONS (type=PROVA):');
    const { rows: docs } = await query(`
        SELECT d.id, d.title, d.institution, d.year, d.type,
               COUNT(q.id) as question_count
        FROM documents d
        LEFT JOIN questions q ON q.document_id = d.id
        WHERE d.type = 'PROVA'
        GROUP BY d.id, d.title, d.institution, d.year, d.type
        ORDER BY COUNT(q.id) DESC
    `);
    const withQ = docs.filter(d => parseInt(d.question_count) > 0);
    const withoutQ = docs.filter(d => parseInt(d.question_count) === 0);
    console.log(`   ${withQ.length} docs WITH questions:`);
    withQ.forEach(d => console.log(`     ✅ ${d.title} (${d.institution} ${d.year}): ${d.question_count} questions`));
    console.log(`   ${withoutQ.length} docs WITHOUT questions (these break exam creation)`);

    // 3. What createFullExamAction would select
    console.log('\n🎯 3. WHAT EXAM CREATION SELECTS (ORDER BY year DESC LIMIT 6):');
    const { rows: selected } = await query(`
        SELECT d.id, d.title, d.institution, d.year,
               COUNT(q.id) as question_count
        FROM documents d
        LEFT JOIN questions q ON q.document_id = d.id
        WHERE d.type = 'PROVA'
        GROUP BY d.id, d.title, d.institution, d.year
        ORDER BY d.year DESC
        LIMIT 6
    `);
    selected.forEach(d => {
        const hasQ = parseInt(d.question_count) > 0;
        console.log(`   ${hasQ ? '✅' : '❌'} ${d.title} (${d.year}): ${d.question_count} questions`);
    });

    // 4. Recent attempts
    console.log('\n📝 4. RECENT ATTEMPTS:');
    const { rows: attempts } = await query(`
        SELECT id, config, status, total_questions, correct_answers, percentage,
               started_at
        FROM attempts
        ORDER BY started_at DESC LIMIT 5
    `);
    attempts.forEach(a => {
        const config = a.config || {};
        console.log(`   ${a.id.substring(0, 8)}... status=${a.status} total=${a.total_questions} correct=${a.correct_answers} pct=${a.percentage}%`);
        console.log(`     documentIds: ${JSON.stringify(config.documentIds || 'NONE')}`);
        console.log(`     questionCount: ${config.questionCount}`);
    });

    process.exit(0);
}

diagnose().catch(e => { console.error(e); process.exit(1); });
