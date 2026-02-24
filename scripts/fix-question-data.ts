/**
 * STEP 1: Fix existing question data quality
 * - Truncate option_e when it bleeds into next question  
 * - Clean stem text (remove PDF garbage, page numbers)
 * - Fix correct_option if needed
 * 
 * Run: npx tsx scripts/fix-question-data.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

async function fix() {
    console.log('\n══════════════════════════════════════════');
    console.log('  STEP 1: LIMPEZA DE DADOS DAS QUESTÕES');
    console.log('══════════════════════════════════════════\n');

    let totalFixed = 0;

    // ============================================
    // 1. Fix option_e bleeding (contains "QUESTÃO")
    // ============================================
    console.log('🔧 1. Corrigindo option_e com bleeding...');

    // Find questions where option_e contains "QUESTÃO" or similar markers
    const { rows: bleedingE } = await query(`
        SELECT id, option_e FROM questions
        WHERE option_e IS NOT NULL AND (
            option_e LIKE '%QUESTÃO%' OR
            option_e LIKE '%Questão%' OR
            option_e LIKE '%questão%' OR 
            option_e LIKE '%) %' AND LENGTH(option_e) > 200
        )
    `);

    console.log(`  Encontradas: ${bleedingE.length} questões com option_e sangrando`);

    for (const q of bleedingE) {
        let cleaned = q.option_e;

        // Cut at "QUESTÃO" marker (case-insensitive)
        const markers = ['QUESTÃO', 'Questão', 'questão'];
        for (const marker of markers) {
            const idx = cleaned.indexOf(marker);
            if (idx > 0) {
                cleaned = cleaned.substring(0, idx).trim();
                // Also remove trailing number (e.g. "31.")
                cleaned = cleaned.replace(/\s*\d+\.\s*$/, '').trim();
                break;
            }
        }

        // If still too long (>300 chars), it probably has garbage
        if (cleaned.length > 300) {
            // Try to find where the actual option ends (after a period or period+space)
            const periodIdx = cleaned.indexOf('. ', 20); // skip first period
            if (periodIdx > 0 && periodIdx < 250) {
                cleaned = cleaned.substring(0, periodIdx + 1).trim();
            }
        }

        if (cleaned !== q.option_e) {
            await query('UPDATE questions SET option_e = $1 WHERE id = $2', [cleaned, q.id]);
            totalFixed++;
        }
    }
    console.log(`  ✅ Corrigidas: ${totalFixed}`);

    // ============================================
    // 2. Clean stems - remove PDF garbage at start
    // ============================================
    console.log('\n🔧 2. Limpando stems...');

    const { rows: allQuestions } = await query('SELECT id, stem, number_in_exam FROM questions');
    let stemsCleaned = 0;

    for (const q of allQuestions) {
        if (!q.stem) continue;
        let cleaned = q.stem;
        const original = cleaned;

        // Remove leading garbage: sequences like "2 2023 ... 31 2024 ... 57"
        // These are page numbers/headers from PDF
        cleaned = cleaned.replace(/^[\s\d.…–\-\/]+(?=\d+\))/m, '');

        // Remove leading question number "1)" or "57) "
        cleaned = cleaned.replace(/^\s*\d+\)\s*/, '');

        // Also remove patterns like "1. " or "57. " at the very start
        cleaned = cleaned.replace(/^\s*\d+\.\s+/, '');

        // Remove orphan page markers at start like "ENARE 2024 – Prova Objetiva  "
        cleaned = cleaned.replace(/^(ENARE|USP|UNICAMP|UNIFESP|SUS-SP|PSU|UNESP|UFES|UFRJ|ISCMSP)\s*\d{4}[^A-Za-zÀ-ú]*(?=\w)/i, '');

        // Remove leading whitespace/newlines
        cleaned = cleaned.trim();

        if (cleaned !== original) {
            await query('UPDATE questions SET stem = $1 WHERE id = $2', [cleaned, q.id]);
            stemsCleaned++;
        }
    }
    console.log(`  ✅ Stems limpos: ${stemsCleaned}/${allQuestions.length}`);

    // ============================================
    // 3. Fix options that contain next question's stem
    // ============================================
    console.log('\n🔧 3. Verificando options A-D com bleeding...');
    let optionsCleaned = 0;

    for (const col of ['option_a', 'option_b', 'option_c', 'option_d']) {
        const { rows: longOpts } = await query(`
            SELECT id, ${col} FROM questions
            WHERE ${col} IS NOT NULL AND LENGTH(${col}) > 300
              AND (${col} LIKE '%QUESTÃO%' OR ${col} LIKE '%Questão%')
        `);

        for (const q of longOpts) {
            let cleaned = q[col];
            const markers = ['QUESTÃO', 'Questão', 'questão'];
            for (const marker of markers) {
                const idx = cleaned.indexOf(marker);
                if (idx > 0) {
                    cleaned = cleaned.substring(0, idx).trim();
                    cleaned = cleaned.replace(/\s*\d+\.\s*$/, '').trim();
                    break;
                }
            }
            if (cleaned !== q[col]) {
                await query(`UPDATE questions SET ${col} = $1 WHERE id = $2`, [cleaned, q.id]);
                optionsCleaned++;
            }
        }
    }
    console.log(`  ✅ Options A-D corrigidas: ${optionsCleaned}`);

    // ============================================
    // Summary
    // ============================================
    console.log('\n══════════════════════════════════════════');
    console.log(`  TOTAL CORRIGIDO: ${totalFixed + stemsCleaned + optionsCleaned} itens`);
    console.log('══════════════════════════════════════════\n');

    process.exit(0);
}

fix().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
