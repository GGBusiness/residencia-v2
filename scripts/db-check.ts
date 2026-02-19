
import { db } from '../lib/db';


// Script de Verificação Pós-Deploy v2
import { db } from '../lib/db';

async function checkSchema() {
    console.log('\n🚀 INICIANDO CHECK-UP DO BANCO DE DADOS (DIGITAL OCEAN)...\n');

    try {
        // 1. Verificar Tabelas Críticas
        const tables = ['users', 'user_profiles', 'user_goals', 'documents', 'questions', 'attempts', 'attempt_answers'];
        console.log('--- 1. Verificando Tabelas ---');

        for (const table of tables) {
            const { rows } = await db.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = $1
                );
            `, [table]);

            const exists = rows[0].exists;
            console.log(`Table '${table}': ${exists ? '✅ EXISTE' : '❌ NÃO ENCONTRADA (CRÍTICO)'}`);

            if (!exists) {
                console.error(`⚠️ ERRO CRÍTICO: Tabela ${table} faltando. O sistema vai falhar.`);
            }
        }

        // 2. Verificar Coluna Crítica do "Monta Provas"
        console.log('\n--- 2. Verificando Correção do Monta Provas ---');
        const { rows } = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'attempts' AND column_name = 'attempt_type';
        `);

        if (rows.length > 0) {
            console.log("Coluna 'attempt_type' em 'attempts': ✅ EXISTE (Monta Provas Ok!)");
        } else {
            console.error("Coluna 'attempt_type' em 'attempts': ❌ FALTANDO! (Monta Provas vai falhar)");
            console.log("👉 Solução: Rode 'npx tsx scripts/setup-monta-provas.sql' ou similar.");
        }

        console.log('\n✅ CHECK-UP FINALIZADO.\n');

    } catch (e) {
        console.error('❌ Erro de conexão:', e);
    } finally {
        process.exit(0);
    }
}

checkSchema();

