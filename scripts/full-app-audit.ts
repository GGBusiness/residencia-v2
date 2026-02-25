/**
 * COMPREHENSIVE APP AUDIT — Tests every critical path
 * Run: npx tsx scripts/full-app-audit.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

const PASS = '✅';
const FAIL = '❌';
const WARN = '⚠️';

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    detail: string;
}

const results: TestResult[] = [];

function test(name: string, status: 'PASS' | 'FAIL' | 'WARN', detail: string) {
    const icon = status === 'PASS' ? PASS : status === 'FAIL' ? FAIL : WARN;
    console.log(`  ${icon} ${name}: ${detail}`);
    results.push({ name, status, detail });
}

async function audit() {
    console.log('\n════════════════════════════════════════════════════');
    console.log('  🏥 COMPREHENSIVE APP AUDIT — All Critical Paths');
    console.log('════════════════════════════════════════════════════\n');

    // ==========================================
    // 1. DATABASE TABLES & SCHEMA
    // ==========================================
    console.log('📦 1. DATABASE TABLES & SCHEMA\n');

    const requiredTables = [
        'users', 'profiles', 'documents', 'questions', 'attempts',
        'attempt_answers', 'study_events', 'user_goals',
        'user_question_progress', 'document_embeddings', 'api_usage_logs'
    ];

    for (const table of requiredTables) {
        try {
            const { rows: [{ count }] } = await query(`SELECT COUNT(*) as count FROM ${table}`);
            test(`Table: ${table}`, 'PASS', `${count} rows`);
        } catch (e: any) {
            if (e.message.includes('does not exist') || e.message.includes('relation')) {
                test(`Table: ${table}`, 'FAIL', 'TABLE MISSING');
            } else {
                test(`Table: ${table}`, 'WARN', e.message.substring(0, 60));
            }
        }
    }

    // ==========================================
    // 2. DOCUMENTS — Required for Monta Provas
    // ==========================================
    console.log('\n📄 2. DOCUMENTS (Monta Provas source)\n');

    // Check if documents have the 'type' column (used by exam-actions.ts)
    try {
        const { rows: cols } = await query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'documents' ORDER BY ordinal_position
        `);
        const colNames = cols.map(c => c.column_name);
        console.log(`  Columns: ${colNames.join(', ')}`);

        // CRITICAL: exam-actions.ts line 39 uses WHERE type = 'PROVA'
        if (colNames.includes('type')) {
            test('documents.type column', 'PASS', 'exists');
            const { rows: types } = await query(`SELECT DISTINCT type, COUNT(*) as c FROM documents GROUP BY type`);
            types.forEach(t => console.log(`    type="${t.type}": ${t.c} docs`));

            const provaCount = types.find(t => t.type === 'PROVA')?.c || 0;
            if (provaCount === 0) {
                test('Documents with type=PROVA', 'FAIL', 'NO documents have type=PROVA — Monta Provas will find ZERO docs!');
            } else {
                test('Documents with type=PROVA', 'PASS', `${provaCount} docs`);
            }
        } else if (colNames.includes('doc_type')) {
            test('documents.type column', 'FAIL', 'Column is named "doc_type" not "type" — exam-actions.ts queries WHERE type=PROVA which will FAIL!');
            const { rows: types } = await query(`SELECT DISTINCT doc_type, COUNT(*) as c FROM documents GROUP BY doc_type`);
            types.forEach(t => console.log(`    doc_type="${t.doc_type}": ${t.c} docs`));
        } else {
            test('documents.type column', 'FAIL', 'No type/doc_type column found — Monta Provas WILL CRASH');
        }

        // Check if documents have questions linked
        const { rows: docsWithQ } = await query(`
            SELECT d.id, d.title, d.institution, d.year, COUNT(q.id) as qcount
            FROM documents d LEFT JOIN questions q ON q.document_id = d.id
            GROUP BY d.id, d.title, d.institution, d.year
            ORDER BY qcount DESC LIMIT 10
        `);
        const withQuestions = docsWithQ.filter(d => parseInt(d.qcount) > 0);
        const noQuestions = docsWithQ.filter(d => parseInt(d.qcount) === 0);
        test('Documents with questions', withQuestions.length > 0 ? 'PASS' : 'FAIL', `${withQuestions.length} have questions, ${noQuestions.length} empty`);

    } catch (e: any) {
        test('Documents schema check', 'FAIL', e.message);
    }

    // ==========================================
    // 3. QUESTIONS — Data Quality
    // ==========================================
    console.log('\n📝 3. QUESTIONS — Data Quality\n');

    try {
        const { rows: [stats] } = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN stem IS NOT NULL AND LENGTH(stem) > 10 THEN 1 END) as good_stems,
                COUNT(CASE WHEN option_a IS NOT NULL THEN 1 END) as has_opt_a,
                COUNT(CASE WHEN option_b IS NOT NULL THEN 1 END) as has_opt_b,
                COUNT(CASE WHEN option_c IS NOT NULL THEN 1 END) as has_opt_c,
                COUNT(CASE WHEN option_d IS NOT NULL THEN 1 END) as has_opt_d,
                COUNT(CASE WHEN correct_option IS NOT NULL THEN 1 END) as has_correct,
                COUNT(CASE WHEN explanation IS NOT NULL AND explanation != '' THEN 1 END) as has_explanation
            FROM questions
        `);
        test('Total questions', 'PASS', stats.total);
        test('Good stems (>10 chars)', parseInt(stats.good_stems) === parseInt(stats.total) ? 'PASS' : 'WARN', `${stats.good_stems}/${stats.total}`);
        test('Has option A', parseInt(stats.has_opt_a) === parseInt(stats.total) ? 'PASS' : 'FAIL', `${stats.has_opt_a}/${stats.total}`);
        test('Has option B', parseInt(stats.has_opt_b) === parseInt(stats.total) ? 'PASS' : 'FAIL', `${stats.has_opt_b}/${stats.total}`);
        test('Has correct_option', parseInt(stats.has_correct) === parseInt(stats.total) ? 'PASS' : 'FAIL', `${stats.has_correct}/${stats.total}`);
        test('Has explanation', parseInt(stats.has_explanation) > 0 ? 'PASS' : 'WARN', `${stats.has_explanation}/${stats.total}`);

        // Check for garbage
        const garbageChecks = [
            { name: 'GABARITO in options', sql: `SELECT COUNT(*) as c FROM questions WHERE option_a LIKE '%GABARITO%' OR option_b LIKE '%GABARITO%' OR option_c LIKE '%GABARITO%' OR option_d LIKE '%GABARITO%' OR option_e LIKE '%GABARITO%'` },
            { name: 'Medway in options', sql: `SELECT COUNT(*) as c FROM questions WHERE option_a LIKE '%Medway%' OR option_b LIKE '%Medway%' OR option_c LIKE '%Medway%' OR option_d LIKE '%Medway%' OR option_e LIKE '%Medway%'` },
            { name: 'Páginas in options', sql: `SELECT COUNT(*) as c FROM questions WHERE option_a LIKE '%Páginas%' OR option_b LIKE '%Páginas%' OR option_c LIKE '%Páginas%' OR option_d LIKE '%Páginas%' OR option_e LIKE '%Páginas%'` },
        ];
        for (const check of garbageChecks) {
            const { rows: [{ c }] } = await query(check.sql);
            test(check.name, parseInt(c) === 0 ? 'PASS' : 'FAIL', `${c} found`);
        }
    } catch (e: any) {
        test('Questions check', 'FAIL', e.message);
    }

    // ==========================================
    // 4. EXAM CREATION FLOW (Monta Provas)
    // ==========================================
    console.log('\n🎯 4. EXAM CREATION FLOW SIMULATION\n');

    try {
        // Simulate what createFullExamAction does
        // Step 1: Select documents with type='PROVA'
        let findDocsQuery = "SELECT id, title FROM documents WHERE type = 'PROVA' ORDER BY year DESC LIMIT 6";
        try {
            const { rows: docs } = await query(findDocsQuery);
            test('Find docs (type=PROVA)', docs.length > 0 ? 'PASS' : 'FAIL', `${docs.length} found`);
        } catch (e: any) {
            // Maybe the column is doc_type
            test('Find docs (type=PROVA)', 'FAIL', `Query failed: ${e.message.substring(0, 80)}`);

            // Try with doc_type
            try {
                const { rows: docs2 } = await query("SELECT id, title FROM documents WHERE doc_type = 'PROVA' ORDER BY year DESC LIMIT 6");
                test('Find docs (doc_type=PROVA)', docs2.length > 0 ? 'PASS' : 'WARN', `${docs2.length} found with doc_type`);
            } catch {
                // Try without type filter
                const { rows: docs3 } = await query("SELECT id, title FROM documents ORDER BY year DESC LIMIT 6");
                test('Find docs (no filter)', docs3.length > 0 ? 'PASS' : 'FAIL', `${docs3.length} found without type filter`);
            }
        }

        // Step 2: Check profiles table for FK
        const { rows: profileCols } = await query(`
            SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles'
        `);
        test('Profiles table columns', profileCols.length > 0 ? 'PASS' : 'FAIL', profileCols.map(c => c.column_name).join(', '));

    } catch (e: any) {
        test('Exam flow simulation', 'FAIL', e.message);
    }

    // ==========================================
    // 5. QUIZ LOADING FLOW
    // ==========================================
    console.log('\n📖 5. QUIZ LOADING FLOW SIMULATION\n');

    try {
        // Get a recent attempt
        const { rows: attempts } = await query('SELECT id, config, status FROM attempts ORDER BY created_at DESC LIMIT 1');
        if (attempts.length > 0) {
            const attempt = attempts[0];
            const config = attempt.config || {};
            test('Latest attempt', 'PASS', `id=${attempt.id.substring(0, 8)}... status=${attempt.status}`);

            if (config.documentIds && config.documentIds.length > 0) {
                // Simulate getQuizDataAction
                const { rows: questions } = await query(`
                    SELECT q.id, q.stem, q.correct_option, d.institution
                    FROM questions q JOIN documents d ON q.document_id = d.id
                    WHERE q.document_id = ANY($1::uuid[])
                    LIMIT 20
                `, [config.documentIds]);
                test('Load questions by documentIds', questions.length > 0 ? 'PASS' : 'FAIL', `${questions.length} loaded`);
            } else {
                test('Attempt config.documentIds', 'WARN', 'No documentIds in config');
            }

            // Check attempt_answers
            try {
                const { rows: [{ count }] } = await query('SELECT COUNT(*) as count FROM attempt_answers WHERE attempt_id = $1', [attempt.id]);
                test('Attempt answers', 'PASS', `${count} answers saved`);
            } catch (e: any) {
                test('Attempt answers', 'FAIL', e.message.substring(0, 60));
            }
        } else {
            test('No attempts found', 'WARN', 'User hasn\'t created any exam yet');
        }
    } catch (e: any) {
        test('Quiz flow', 'FAIL', e.message);
    }

    // ==========================================
    // 6. DASHBOARD DATA DEPENDENCIES
    // ==========================================
    console.log('\n📊 6. DASHBOARD DATA DEPENDENCIES\n');

    const dashTables = ['study_events', 'user_goals', 'user_question_progress'];
    for (const t of dashTables) {
        try {
            const { rows: [{ count }] } = await query(`SELECT COUNT(*) as count FROM ${t}`);
            test(`Table: ${t}`, 'PASS', `${count} rows`);
        } catch (e: any) {
            test(`Table: ${t}`, e.message.includes('does not exist') ? 'FAIL' : 'WARN', e.message.substring(0, 60));
        }
    }

    // ==========================================
    // 7. AI & EXTERNAL SERVICES
    // ==========================================
    console.log('\n🤖 7. AI & EXTERNAL SERVICES\n');

    // OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    test('OPENAI_API_KEY', openaiKey ? 'PASS' : 'FAIL', openaiKey ? 'set' : 'MISSING');

    if (openaiKey) {
        try {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { 'Authorization': `Bearer ${openaiKey}` },
            });
            test('OpenAI API connection', res.ok ? 'PASS' : 'FAIL', `HTTP ${res.status}`);
        } catch (e: any) {
            test('OpenAI API connection', 'FAIL', e.message);
        }
    }

    // Supabase
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    test('Supabase URL', supaUrl ? 'PASS' : 'FAIL', supaUrl ? 'set' : 'MISSING');
    test('Supabase Anon Key', supaKey ? 'PASS' : 'FAIL', supaKey ? 'set' : 'MISSING');

    // DigitalOcean Spaces
    const spacesKey = process.env.SPACES_KEY;
    const spacesSecret = process.env.SPACES_SECRET;
    test('SPACES_KEY', spacesKey ? 'PASS' : 'FAIL', spacesKey ? 'set' : 'MISSING');
    test('SPACES_SECRET', spacesSecret ? 'PASS' : 'FAIL', spacesSecret ? 'set' : 'MISSING');

    // ==========================================
    // 8. ENVIRONMENT VARIABLES (Vercel)
    // ==========================================
    console.log('\n🔑 8. CRITICAL ENV VARS\n');

    const criticalEnvs = [
        'DIGITALOCEAN_DB_URL', 'OPENAI_API_KEY',
        'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY', 'SPACES_KEY', 'SPACES_SECRET',
        'SPACES_BUCKET', 'SPACES_REGION', 'SPACES_ENDPOINT',
        'ADMIN_SECRET_KEY'
    ];
    for (const env of criticalEnvs) {
        test(`ENV: ${env}`, process.env[env] ? 'PASS' : (env === 'ADMIN_SECRET_KEY' ? 'WARN' : 'FAIL'), process.env[env] ? 'set' : 'MISSING');
    }

    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    console.log('\n════════════════════════════════════════════════════');
    console.log('  📊 FINAL SUMMARY');
    console.log('════════════════════════════════════════════════════\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warned = results.filter(r => r.status === 'WARN').length;

    console.log(`  ${PASS} PASS: ${passed}    ${FAIL} FAIL: ${failed}    ${WARN} WARN: ${warned}\n`);

    if (failed > 0) {
        console.log('  🔴 CRITICAL FAILURES (must fix):');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`    ${FAIL} ${r.name}: ${r.detail}`);
        });
    }
    if (warned > 0) {
        console.log('\n  🟡 WARNINGS (should investigate):');
        results.filter(r => r.status === 'WARN').forEach(r => {
            console.log(`    ${WARN} ${r.name}: ${r.detail}`);
        });
    }

    console.log('\n════════════════════════════════════════════════════\n');
    process.exit(failed > 0 ? 1 : 0);
}

audit().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
