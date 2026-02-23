
import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';
import OpenAI from 'openai';

// Carregar .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// IMPORTANTE: Permitir certificados auto-assinados (DigitalOcean)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function verifySystem() {
    console.log('\n🔍 INICIANDO VARREDURA COMPLETA DO SISTEMA...\n');
    let errors = 0;

    // 1. VERIFICAÇÃO DE AMBIENTE
    console.log('1️⃣  VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE');
    const requiredVars = [
        'DIGITALOCEAN_DB_URL',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'OPENAI_API_KEY'
    ];

    requiredVars.forEach(varName => {
        if (process.env[varName]) {
            console.log(`   ✅ ${varName}: OK`);
        } else {
            console.error(`   ❌ ${varName}: AUSENTE`);
            errors++;
        }
    });

    // 2. VERIFICAÇÃO DO BANCO DE DADOS (POSTGRES)
    console.log('\n2️⃣  CONEXÃO COM BANCO DE DADOS (DIGITAL OCEAN)');
    const pool = new pg.Pool({
        connectionString: process.env.DIGITALOCEAN_DB_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        const client = await pool.connect();
        console.log('   ✅ Conexão TCP estabelecida');

        const res = await client.query('SELECT version()');
        console.log(`   ✅ Versão do Postgres: ${res.rows[0].version}`);

        // Verificando Tabelas Principais
        const tables = ['users', 'documents', 'questions', 'attempts', 'ai_usage_logs'];

        for (const table of tables) {
            try {
                const countRes = await client.query(`SELECT COUNT(*) FROM ${table}`);
                const count = countRes.rows[0].count;
                console.log(`   📊 Tabela '${table}': ${count} registros (Tabela Existe e Acessível)`);

                if (table === 'questions' && parseInt(count) === 0) {
                    console.warn(`   ⚠️  ALERTA: Tabela de questões está vazia! "Monta Provas" não funcionará.`);
                }
            } catch (err: any) {
                console.error(`   ❌ Erro na tabela '${table}':`, err.message);
                errors++;
            }
        }

        // 3. SIMULAÇÃO DE "MONTA PROVAS" (DATA RETRIEVAL)
        console.log('\n3️⃣  TESTE DE LÓGICA DE RECUPERAÇÃO (MONTA PROVAS)');
        const retrievalQuery = `
            SELECT d.title, COUNT(q.id) as q_count 
            FROM documents d
            LEFT JOIN questions q ON q.document_id = d.id 
            WHERE d.type = 'PROVA'
            GROUP BY d.id, d.title
            LIMIT 5
        `;
        const retrievalRes = await client.query(retrievalQuery);
        if (retrievalRes.rows.length > 0) {
            console.log('   ✅ Query de Provas retornou dados:');
            retrievalRes.rows.forEach(row => {
                console.log(`      - ${row.title}: ${row.q_count} questões`);
            });
        } else {
            console.warn('   ⚠️  Nenhuma prova encontrada com questões vinculadas.');
        }

        client.release();
    } catch (err: any) {
        console.error('   ❌ FALHA CRÍTICA NO BANCO:', err.message);
        errors++;
    } finally {
        await pool.end();
    }

    // 4. VERIFICAÇÃO OPENAI (INTELIGÊNCIA ARTIFICIAL)
    console.log('\n4️⃣  INTEGRAÇÃO OPENAI (GPT-4 / EMBEDDINGS)');
    if (process.env.OPENAI_API_KEY) {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        try {
            console.log('   🔄 Testando conexão com OpenAI...');
            const start = Date.now();
            // Teste simples de modelos (não gasta muito)
            const models = await openai.models.list();
            const duration = Date.now() - start;
            console.log(`   ✅ Conexão OpenAI OK (${duration}ms)`);
            console.log(`   ✅ Modelos disponíveis: ${models.data.length > 0 ? 'SIM' : 'NÃO'}`);

            // Verificando se gpt-4o está disponível (importante para o ingesto)
            const hasGpt4 = models.data.some(m => m.id.includes('gpt-4'));
            console.log(`   ✅ Modelo GPT-4 disponível: ${hasGpt4 ? 'SIM' : 'NÃO'}`);

        } catch (err: any) {
            console.error('   ❌ Erro na OpenAI:', err.message);
            errors++;
        }
    } else {
        console.log('   ⏭️  Pular teste OpenAI (Sem chave)');
    }

    // RELATÓRIO FINAL
    console.log('\n=========================================');
    if (errors === 0) {
        console.log('✅✅ SISTEMA 100% OPERACIONAL PARA PRODUÇÃO ✅✅');
        console.log('Todas as conexões foram verificadas e responderam corretamente.');
    } else {
        console.log(`⚠️  SISTEMA APRESENTOU ${errors} ERROS`);
        console.log('Verifique os logs acima antes de prosseguir.');
    }
    console.log('=========================================\n');
}

verifySystem().catch(console.error);
