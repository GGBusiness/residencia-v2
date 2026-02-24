/**
 * FULL database diagnostic - checks everything.
 * Run: npx tsx scripts/db-diagnostic.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query } from '../lib/db';

async function diagnose() {
    console.log('\n══════════════════════════════════════════');
    console.log('  DIAGNÓSTICO COMPLETO DO BANCO DE DADOS');
    console.log('══════════════════════════════════════════\n');

    // 1. Connection
    const { rows: [{ now }] } = await query('SELECT NOW() as now');
    console.log(`✅ Conexão OK: ${now}\n`);

    // 2. All tables
    const { rows: tables } = await query(`
        SELECT table_name, 
               (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as col_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `);
    console.log('📋 TABELAS:');
    for (const t of tables) {
        const { rows: [{ count }] } = await query(`SELECT COUNT(*) as count FROM "${t.table_name}"`);
        console.log(`  ${t.table_name}: ${count} registros (${t.col_count} colunas)`);
    }

    // 3. Documents detail
    console.log('\n📄 DOCUMENTOS (por tipo):');
    const { rows: docTypes } = await query(`SELECT type, COUNT(*) as c FROM documents GROUP BY type ORDER BY c DESC`);
    docTypes.forEach(r => console.log(`  ${r.type}: ${r.c}`));

    // 4. Questions
    console.log('\n❓ QUESTÕES:');
    const { rows: [{ total_q }] } = await query('SELECT COUNT(*) as total_q FROM questions');
    console.log(`  Total: ${total_q}`);

    const { rows: qByDoc } = await query(`
        SELECT d.title, d.id as doc_id, COUNT(q.id) as q_count
        FROM documents d
        LEFT JOIN questions q ON q.document_id = d.id
        WHERE d.type = 'PROVA'
        GROUP BY d.id, d.title
        ORDER BY q_count DESC
        LIMIT 10
    `);
    console.log('  Top 10 documentos com questões:');
    qByDoc.forEach(r => console.log(`    ${r.q_count} questões — ${r.title} (${r.doc_id})`));

    // 5. Documents WITHOUT questions
    const { rows: noQuestions } = await query(`
        SELECT d.id, d.title, d.type
        FROM documents d
        LEFT JOIN questions q ON q.document_id = d.id
        WHERE d.type = 'PROVA' AND q.id IS NULL
    `);
    if (noQuestions.length > 0) {
        console.log(`\n⚠️  PROVAS SEM QUESTÕES: ${noQuestions.length}`);
        noQuestions.forEach(d => console.log(`    ${d.title} (${d.id})`));
    } else {
        console.log('\n✅ Todas as provas têm questões');
    }

    // 6. Question structure sample
    console.log('\n🔬 AMOSTRA DE QUESTÃO:');
    const { rows: sampleQ } = await query('SELECT * FROM questions LIMIT 1');
    if (sampleQ.length > 0) {
        const q = sampleQ[0];
        console.log(`  Colunas: ${Object.keys(q).join(', ')}`);
        console.log(`  ID: ${q.id}`);
        console.log(`  document_id: ${q.document_id}`);
        console.log(`  stem: ${(q.stem || '').substring(0, 100)}...`);
        console.log(`  options: A=${!!q.option_a} B=${!!q.option_b} C=${!!q.option_c} D=${!!q.option_d} E=${!!q.option_e}`);
        console.log(`  correct: ${q.correct_option}`);
        console.log(`  area: ${q.area}`);
    } else {
        console.log('  ❌ NENHUMA QUESTÃO NO BANCO!');
    }

    // 7. Profiles & Users sync
    console.log('\n👤 USUÁRIOS/PROFILES:');
    const { rows: [{ u_count }] } = await query('SELECT COUNT(*) as u_count FROM users');
    const { rows: [{ p_count }] } = await query('SELECT COUNT(*) as p_count FROM profiles');
    console.log(`  users: ${u_count}, profiles: ${p_count}`);
    const { rows: missingProfiles } = await query(`
        SELECT u.id, u.email FROM users u LEFT JOIN profiles p ON u.id = p.id WHERE p.id IS NULL
    `);
    if (missingProfiles.length > 0) {
        console.log(`  ⚠️ ${missingProfiles.length} users sem profile`);
    } else {
        console.log('  ✅ Todos sincronizados');
    }

    // 8. Attempts table
    console.log('\n📝 ATTEMPTS:');
    const { rows: attCols } = await query(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_name = 'attempts' ORDER BY ordinal_position
    `);
    console.log(`  Colunas: ${attCols.map(c => c.column_name).join(', ')}`);
    const { rows: [{ att_count }] } = await query('SELECT COUNT(*) as att_count FROM attempts');
    console.log(`  Total attempts: ${att_count}`);

    // 9. FK constraints
    console.log('\n🔗 FOREIGN KEYS:');
    const { rows: fks } = await query(`
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        ORDER BY tc.table_name
    `);
    fks.forEach(r => console.log(`  ${r.table_name}.${r.column_name} → ${r.ref_table}`));

    // 10. Test the full quiz flow: attempt → questions
    console.log('\n🧪 TESTE FLUXO QUIZ:');
    const { rows: testDocs } = await query(`
        SELECT d.id FROM documents d
        JOIN questions q ON q.document_id = d.id
        WHERE d.type = 'PROVA'
        GROUP BY d.id
        HAVING COUNT(q.id) > 0
        LIMIT 2
    `);
    if (testDocs.length > 0) {
        const docId = testDocs[0].id;
        const { rows: qs } = await query('SELECT id, number_in_exam, stem FROM questions WHERE document_id = $1 ORDER BY number_in_exam LIMIT 3', [docId]);
        console.log(`  Doc ${docId}: ${qs.length} questões carregadas`);
        qs.forEach(q => console.log(`    #${q.number_in_exam}: ${(q.stem || '').substring(0, 80)}...`));
        console.log('  ✅ Quiz flow OK');
    } else {
        console.log('  ❌ Nenhum documento com questões!');
    }

    // 11. Env vars check
    console.log('\n🔑 ENV VARS:');
    const envCheck = [
        'DIGITALOCEAN_DB_URL',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'OPENAI_API_KEY',
    ];
    envCheck.forEach(k => {
        const val = process.env[k];
        console.log(`  ${k}: ${val ? `✅ (${val.substring(0, 20)}...)` : '❌ MISSING'}`);
    });

    console.log('\n══════════════════════════════════════════');
    console.log('  DIAGNÓSTICO COMPLETO');
    console.log('══════════════════════════════════════════\n');

    process.exit(0);
}

diagnose().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
