import { query } from '../lib/db';

async function verifyDatabase() {
    console.log('\n=== VERIFICAÇÃO COMPLETA DO BANCO DE DADOS ===\n');

    try {
        // 1. Questions
        const q = await query('SELECT COUNT(*) as total FROM questions');
        console.log(`✅ Questions: ${q.rows[0].total}`);

        // Sample questions
        const sample = await query('SELECT id, stem, correct_option, document_id FROM questions ORDER BY created_at DESC LIMIT 3');
        sample.rows.forEach((r: any, i: number) => {
            console.log(`   ${i + 1}. [${r.correct_option}] ${r.stem?.substring(0, 80)}... (doc: ${r.document_id})`);
        });
    } catch (e: any) {
        console.log(`❌ Questions: ${e.message}`);
    }

    try {
        // 2. Documents
        const d = await query('SELECT COUNT(*) as total FROM documents');
        console.log(`\n✅ Documents: ${d.rows[0].total}`);

        const docs = await query('SELECT id, title, doc_type, institution FROM documents ORDER BY created_at DESC LIMIT 5');
        docs.rows.forEach((r: any, i: number) => {
            console.log(`   ${i + 1}. [${r.doc_type}] ${r.title} (${r.institution})`);
        });
    } catch (e: any) {
        console.log(`❌ Documents: ${e.message}`);
    }

    try {
        // 3. Embeddings (RAG / Tutor IA)
        const e = await query('SELECT COUNT(*) as total FROM document_embeddings');
        console.log(`\n✅ Embeddings (Tutor IA): ${e.rows[0].total}`);

        if (parseInt(e.rows[0].total) > 0) {
            const sample = await query('SELECT document_id, LENGTH(content) as content_len FROM document_embeddings LIMIT 3');
            sample.rows.forEach((r: any, i: number) => {
                console.log(`   ${i + 1}. doc_id: ${r.document_id}, content: ${r.content_len} chars`);
            });
            console.log('   → Tutor IA TEM dados para RAG');
        } else {
            console.log('   ⚠️ Tutor IA NÃO tem dados para RAG');
        }
    } catch (e: any) {
        console.log(`❌ Embeddings: ${e.message}`);
    }

    try {
        // 4. Attempts
        const a = await query('SELECT COUNT(*) as total FROM attempts');
        console.log(`\n✅ Attempts: ${a.rows[0].total}`);
    } catch (e: any) {
        console.log(`❌ Attempts: ${e.message}`);
    }

    try {
        // 5. Profiles
        const p = await query('SELECT COUNT(*) as total FROM profiles');
        console.log(`\n✅ Profiles (Users): ${p.rows[0].total}`);
    } catch (e: any) {
        console.log(`❌ Profiles: ${e.message}`);
    }

    try {
        // 6. Study Events
        const se = await query('SELECT COUNT(*) as total FROM study_events');
        console.log(`✅ Study Events: ${se.rows[0].total}`);
    } catch (e: any) {
        console.log(`⚠️ Study Events: ${e.message}`);
    }

    try {
        // 7. Cut Scores
        const cs = await query('SELECT COUNT(*) as total FROM cut_scores');
        console.log(`✅ Cut Scores: ${cs.rows[0].total}`);
    } catch (e: any) {
        console.log(`⚠️ Cut Scores: tabela não existe (sem dados de notas de corte)`);
    }

    try {
        // 8. Verify questions are linked to documents
        const linked = await query(`
            SELECT d.title, COUNT(q.id) as question_count 
            FROM documents d 
            LEFT JOIN questions q ON q.document_id = d.id 
            GROUP BY d.id, d.title 
            ORDER BY question_count DESC 
            LIMIT 10
        `);
        console.log('\n=== DOCUMENTOS COM QUESTÕES ===');
        linked.rows.forEach((r: any, i: number) => {
            const status = parseInt(r.question_count) > 0 ? '✅' : '⚠️';
            console.log(`   ${status} ${r.title}: ${r.question_count} questões`);
        });
    } catch (e: any) {
        console.log(`❌ Link check: ${e.message}`);
    }

    console.log('\n=== VERIFICAÇÃO CONCLUÍDA ===\n');
    process.exit(0);
}

verifyDatabase().catch(e => {
    console.error('FATAL ERROR:', e);
    process.exit(1);
});
