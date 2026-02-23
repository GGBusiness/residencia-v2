import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function investigateAndFixQuestions() {
    console.log('\n🔍 INVESTIGAÇÃO COMPLETA DAS QUESTÕES...\n');

    const pool = new pg.Pool({
        connectionString: process.env.DIGITALOCEAN_DB_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
    });

    try {
        const client = await pool.connect();

        // 1. PANORAMA GERAL
        console.log('1️⃣  PANORAMA GERAL');
        const { rows: docCount } = await client.query('SELECT COUNT(*) as total FROM documents');
        const { rows: qCount } = await client.query('SELECT COUNT(*) as total FROM questions');
        console.log(`   📄 Total de Documentos: ${docCount[0].total}`);
        console.log(`   ❓ Total de Questões: ${qCount[0].total}`);

        // 2. QUESTÕES COM document_id VÁLIDO vs NULO
        console.log('\n2️⃣  VINCULAÇÃO DE QUESTÕES');
        const { rows: linked } = await client.query(`
            SELECT COUNT(*) as total FROM questions WHERE document_id IS NOT NULL
        `);
        const { rows: unlinked } = await client.query(`
            SELECT COUNT(*) as total FROM questions WHERE document_id IS NULL
        `);
        console.log(`   ✅ Questões com document_id: ${linked[0].total}`);
        console.log(`   ❌ Questões SEM document_id (NULL): ${unlinked[0].total}`);

        // 3. DISTRIBUIÇÃO POR DOCUMENTO
        console.log('\n3️⃣  DISTRIBUIÇÃO: QUESTÕES POR DOCUMENTO');
        const { rows: distribution } = await client.query(`
            SELECT d.id, d.title, d.type, d.institution, d.year, COUNT(q.id) as q_count
            FROM documents d
            LEFT JOIN questions q ON q.document_id = d.id
            GROUP BY d.id, d.title, d.type, d.institution, d.year
            ORDER BY q_count DESC
            LIMIT 15
        `);
        distribution.forEach(row => {
            const icon = parseInt(row.q_count) > 0 ? '✅' : '⚪';
            console.log(`   ${icon} [${row.institution || '?'}] ${row.title?.substring(0, 60)} → ${row.q_count} questões`);
        });

        // 4. AMOSTRA DE QUESTÕES "SOLTAS" (sem document_id)
        console.log('\n4️⃣  AMOSTRA DE QUESTÕES SEM DOCUMENT_ID');
        const { rows: sampleUnlinked } = await client.query(`
            SELECT id, stem, area, institution, correct_option
            FROM questions
            WHERE document_id IS NULL
            LIMIT 5
        `);
        if (sampleUnlinked.length > 0) {
            sampleUnlinked.forEach((q, i) => {
                console.log(`   📝 Q${i + 1}: [${q.area || '?'}] [${q.institution || '?'}] ${q.stem?.substring(0, 80)}...`);
            });
        } else {
            console.log('   ✅ Nenhuma questão sem document_id!');
        }

        // 5. VERIFICAR SE QUESTÕES TEM CAMPO institution/area PRÓPRIO
        console.log('\n5️⃣  CAMPOS DAS QUESTÕES');
        const { rows: qColumns } = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'questions'
            ORDER BY ordinal_position
        `);
        console.log('   Colunas da tabela questions:');
        qColumns.forEach(col => {
            console.log(`      - ${col.column_name} (${col.data_type})`);
        });

        // 6. VERIFICAR QUESTÕES COM document_id QUE APONTA PARA DOCS INEXISTENTES
        console.log('\n6️⃣  QUESTÕES COM document_id INVÁLIDO (orphans)');
        const { rows: orphans } = await client.query(`
            SELECT COUNT(*) as total
            FROM questions q
            LEFT JOIN documents d ON q.document_id = d.id
            WHERE q.document_id IS NOT NULL AND d.id IS NULL
        `);
        console.log(`   Questões órfãs (document_id aponta para doc inexistente): ${orphans[0].total}`);

        // 7. QUESTÕES COM document_id VÁLIDO - TOP 5 documentos
        console.log('\n7️⃣  TOP 5 DOCUMENTOS COM MAIS QUESTÕES');
        const { rows: top5 } = await client.query(`
            SELECT d.title, d.institution, d.year, COUNT(q.id) as q_count
            FROM questions q
            JOIN documents d ON q.document_id = d.id
            GROUP BY d.id, d.title, d.institution, d.year
            ORDER BY q_count DESC
            LIMIT 5
        `);
        if (top5.length > 0) {
            top5.forEach(row => {
                console.log(`   🏆 [${row.institution}/${row.year}] ${row.title?.substring(0, 50)} → ${row.q_count} questões`);
            });
        } else {
            console.log('   ⚠️ Nenhuma questão vinculada a documentos!');
        }

        // 8. VERIFICAR SE HÁ ALGUM PADRÃO PARA VINCULAR
        console.log('\n8️⃣  POSSIBILIDADES DE AUTO-VINCULAÇÃO');
        const { rows: qInstitutions } = await client.query(`
            SELECT institution, area, COUNT(*) as total
            FROM questions
            WHERE document_id IS NULL AND institution IS NOT NULL
            GROUP BY institution, area
            ORDER BY total DESC
            LIMIT 10
        `);
        if (qInstitutions.length > 0) {
            console.log('   Questões soltas por instituição/área:');
            qInstitutions.forEach(row => {
                console.log(`      - ${row.institution} / ${row.area}: ${row.total} questões`);
            });
        }

        // Tentar match por institution + year
        const { rows: matchable } = await client.query(`
            SELECT q.institution as q_inst, d.institution as d_inst, d.title, COUNT(q.id) as match_count
            FROM questions q
            JOIN documents d ON LOWER(q.institution) = LOWER(d.institution)
            WHERE q.document_id IS NULL AND q.institution IS NOT NULL
            GROUP BY q.institution, d.institution, d.title
            ORDER BY match_count DESC
            LIMIT 10
        `);
        if (matchable.length > 0) {
            console.log('\n   🔗 POSSÍVEIS MATCHES (institution):');
            matchable.forEach(row => {
                console.log(`      Q[${row.q_inst}] → D[${row.d_inst}] "${row.title?.substring(0, 50)}" (${row.match_count} questões)`);
            });
        }

        client.release();

        // RELATÓRIO FINAL
        console.log('\n=========================================');
        console.log('📊 RESUMO DA INVESTIGAÇÃO');
        console.log(`   Documentos: ${docCount[0].total}`);
        console.log(`   Questões Total: ${qCount[0].total}`);
        console.log(`   Vinculadas: ${linked[0].total}`);
        console.log(`   Soltas: ${unlinked[0].total}`);
        console.log(`   Orphans: ${orphans[0].total}`);
        console.log('=========================================\n');

    } catch (err: any) {
        console.error('❌ ERRO:', err.message);
    } finally {
        await pool.end();
    }
}

investigateAndFixQuestions().catch(console.error);
