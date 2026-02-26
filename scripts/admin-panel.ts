import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query } from '../lib/db';

async function runAdminPanel() {
    console.clear();
    console.log('\n=============================================================');
    console.log('  🛡️  RESIDÊNCIA MÉDICA AI - PAINEL ADMIN (TERMINAL)  🛡️');
    console.log('=============================================================\n');

    console.log('Carregando métricas em tempo real...\n');

    try {
        // 1. Basic Counts
        const { rows: [{ count: userCount }] } = await query("SELECT COUNT(*) as count FROM profiles").catch(() => ({ rows: [{ count: 0 }] }));

        const today = new Date().toISOString().split('T')[0];
        const { rows: [{ count: newUsersToday }] } = await query("SELECT COUNT(*) as count FROM profiles WHERE created_at >= $1", [today]).catch(() => ({ rows: [{ count: 0 }] }));

        const { rows: [{ count: attemptsToday }] } = await query("SELECT COUNT(*) as count FROM attempts WHERE started_at >= $1", [today]).catch(() => ({ rows: [{ count: 0 }] }));

        const { rows: [{ count: totalQuestions }] } = await query("SELECT COUNT(*) as count FROM questions").catch(() => ({ rows: [{ count: 0 }] }));

        const { rows: [{ count: totalDocuments }] } = await query("SELECT COUNT(*) as count FROM documents").catch(() => ({ rows: [{ count: 0 }] }));

        const { rows: [{ count: aiQuestionsCount }] } = await query("SELECT COUNT(*) as count FROM questions q JOIN documents d ON q.document_id = d.id WHERE d.title = 'AI-Generated Questions'").catch(() => ({ rows: [{ count: 0 }] }));

        // 2. Costs
        let totalCost = 0;
        let lastCalls = [];
        try {
            const { rows: costData } = await query(`SELECT cost_usd, provider, created_at FROM api_usage_logs ORDER BY created_at DESC LIMIT 5`);
            lastCalls = costData;
            const { rows: [{ sum: costSum }] } = await query(`SELECT SUM(cost_usd) as sum FROM api_usage_logs`);
            totalCost = Number(costSum) || 0;
        } catch (e) {
            // Se a tabela api_usage_logs não existir
        }

        // --- RENDER OUTPUT ---
        console.log('👥 USUÁRIOS E USO');
        console.log(`  • Usuários Totais:     ${userCount}`);
        console.log(`  • Novos Hoje:          +${newUsersToday}`);
        console.log(`  • Simulados Hoje:      ${attemptsToday}`);

        console.log('\n📚 CONTEÚDO E BANCO DE QUESTÕES');
        console.log(`  • Documentos (Provas): ${totalDocuments}`);
        console.log(`  • Questões Totais:     ${totalQuestions}`);
        if (aiQuestionsCount > 0) {
            console.log(`  • Questões IA:         ${aiQuestionsCount} (geradas dinamicamente)`);
        }

        console.log('\n💰 CUSTOS DE API E INTELIGÊNCIA ARTIFICIAL');
        console.log(`  • Total Gasto:         $${totalCost.toFixed(4)} USD`);

        if (lastCalls.length > 0) {
            console.log('\n  Últimas 5 chamadas:');
            lastCalls.forEach((call: any, idx: number) => {
                const date = new Date(call.created_at).toLocaleString();
                console.log(`  [${String(idx + 1).padStart(2, '0')}] ${date} | ${call.provider.padEnd(8)} | $${Number(call.cost_usd).toFixed(5)}`);
            });
        }

        console.log('\n=============================================================');
        console.log('Comandos Úteis:');
        console.log('📋 Para importar provas em lote: npm run bash scripts/batch-extract-pdfs.ts');
        console.log('🩺 Para checar a saúde geral:    npm run bash scripts/system-health-check.ts');
        console.log('=============================================================\n');

    } catch (error: any) {
        console.error('❌ Erro crítico ao conectar com o banco de dados:', error.message);
    }

    process.exit(0);
}

runAdminPanel();
