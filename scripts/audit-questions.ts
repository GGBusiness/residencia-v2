import { query } from '../lib/db';

/**
 * Script para auditar e limpar questões de baixa qualidade no banco.
 * Identifica e remove:
 * 1. Enunciados cortados (começam com minúscula = fragmento)
 * 2. Alternativas duplicadas/similares dentro da mesma questão
 * 3. Enunciados muito curtos (< 30 chars)
 * 4. Alternativas faltando (A-D obrigatórias)
 */
async function auditAndCleanQuestions() {
    console.log('\n🔍 === AUDITORIA DE QUALIDADE DAS QUESTÕES ===\n');

    const { rows: allQuestions } = await query(`
        SELECT id, stem, option_a, option_b, option_c, option_d, option_e, correct_option, document_id
        FROM questions
        ORDER BY created_at DESC
    `);

    console.log(`Total de questões no banco: ${allQuestions.length}\n`);

    const issues: { id: string; reason: string; stem: string }[] = [];

    for (const q of allQuestions) {
        const stem = q.stem || '';

        // 1. Stem muito curto
        if (stem.length < 30) {
            issues.push({ id: q.id, reason: 'ENUNCIADO CURTO', stem: stem.substring(0, 80) });
            continue;
        }

        // 2. Stem cortado (começa com minúscula)
        const firstChar = stem.trim()[0];
        if (firstChar && firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase() && !/^\d/.test(stem.trim())) {
            issues.push({ id: q.id, reason: 'ENUNCIADO CORTADO', stem: stem.substring(0, 80) });
            continue;
        }

        // 3. Alternativas faltando
        if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) {
            issues.push({ id: q.id, reason: 'ALTERNATIVAS FALTANDO', stem: stem.substring(0, 80) });
            continue;
        }

        // 4. Alternativas duplicadas/similares
        const allOpts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
            .filter(Boolean)
            .map((o: string) => o.toLowerCase().trim().replace(/[.,;:!?]+$/, ''));

        let hasDuplicate = false;
        for (let i = 0; i < allOpts.length; i++) {
            for (let j = i + 1; j < allOpts.length; j++) {
                // Identicas
                if (allOpts[i] === allOpts[j]) {
                    hasDuplicate = true;
                    break;
                }
                // Similares (>80% match)
                const shorter = allOpts[i].length < allOpts[j].length ? allOpts[i] : allOpts[j];
                const longer = allOpts[i].length >= allOpts[j].length ? allOpts[i] : allOpts[j];
                if (shorter.length > 10 && longer.includes(shorter.substring(0, Math.floor(shorter.length * 0.8)))) {
                    hasDuplicate = true;
                    break;
                }
            }
            if (hasDuplicate) break;
        }

        if (hasDuplicate) {
            issues.push({ id: q.id, reason: 'ALTERNATIVAS SIMILARES', stem: stem.substring(0, 80) });
            continue;
        }

        // 5. correct_option E sem option_e
        if (q.correct_option === 'E' && !q.option_e) {
            issues.push({ id: q.id, reason: 'GABARITO E SEM OPÇÃO E', stem: stem.substring(0, 80) });
            continue;
        }
    }

    console.log(`\n📊 RESULTADO DA AUDITORIA:`);
    console.log(`   ✅ Questões OK: ${allQuestions.length - issues.length}`);
    console.log(`   ⚠️ Questões com problemas: ${issues.length}\n`);

    // Agrupar por tipo de problema
    const grouped: Record<string, typeof issues> = {};
    for (const issue of issues) {
        if (!grouped[issue.reason]) grouped[issue.reason] = [];
        grouped[issue.reason].push(issue);
    }

    for (const [reason, items] of Object.entries(grouped)) {
        console.log(`\n❌ ${reason}: ${items.length} questões`);
        items.slice(0, 3).forEach((item, i) => {
            console.log(`   ${i + 1}. [${item.id}] ${item.stem}...`);
        });
        if (items.length > 3) console.log(`   ... e mais ${items.length - 3}`);
    }

    // Perguntar se deve limpar
    if (issues.length > 0) {
        const arg = process.argv[2];
        if (arg === '--fix') {
            console.log(`\n🗑️ REMOVENDO ${issues.length} questões com problemas...`);
            const ids = issues.map(i => i.id);

            // Deletar em batches de 100
            for (let i = 0; i < ids.length; i += 100) {
                const batch = ids.slice(i, i + 100);
                const placeholders = batch.map((_, idx) => `$${idx + 1}`).join(', ');
                await query(`DELETE FROM questions WHERE id IN (${placeholders})`, batch);
            }

            console.log(`✅ ${issues.length} questões removidas com sucesso!`);

            // Contar restantes
            const { rows: remaining } = await query('SELECT COUNT(*) as total FROM questions');
            console.log(`📊 Questões restantes no banco: ${remaining[0].total}`);
        } else {
            console.log(`\n💡 Para remover as questões com problemas, execute:`);
            console.log(`   npx tsx scripts/audit-questions.ts --fix\n`);
        }
    }

    process.exit(0);
}

auditAndCleanQuestions().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
