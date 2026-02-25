/**
 * DEFINITIVE CLEANUP — Fix ALL remaining data corruption in questions table.
 * 
 * Patterns to fix:
 * 1. GABARITO text in options (e.g. "B C D E GABARITO Medway...")
 * 2. "Páginas X/Y" text in options
 * 3. "Medway - ENARE - 2026" headers in options
 * 4. Option E bleeding into next question (e.g. "...texto. 84) O médico...")
 * 5. Truncated stems starting with lowercase/punctuation
 * 6. Stem starting with page/header garbage
 * 
 * Run: npx tsx scripts/definitive-cleanup.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

// All garbage patterns that can appear mid-text
const GARBAGE_PATTERNS = [
    /\s*GABARITO\b.*/si,                             // "GABARITO..." and everything after
    /\s*Medway\s*[-–]\s*\w+\s*[-–]\s*\d{4}.*/si,    // "Medway - ENARE - 2026..."
    /\s*Medway\s*[-–].*/si,                          // "Medway -" and everything after
    /\s*Páginas?\s*\d+\/\d+.*/si,                    // "Páginas 37/38" and after
    /\s*Página\s*\d+\s*de\s*\d+.*/si,               // "Página 3 de 38"
    /\s*QUESTÃO\s+\d+.*/si,                          // "QUESTÃO 31." and after (bleeding)
    /\s*Questão\s+\d+.*/si,                          // "Questão 31." and after    
    /\s*\d+\)\s+[A-Z][a-záéíóú].{20,}$/s,           // "84) O médico..." (next question bleeding)
];

// Patterns for start-of-stem garbage
const STEM_START_GARBAGE = [
    /^[\d\s.…–\-\/]+(?=\d+\))/m,                    // "2 2023 ... 31 2024 ... 57"
    /^\s*\d+\)\s*/,                                   // "1) " or "57) "
    /^\s*\d+\.\s+/,                                   // "1. " or "57. "
    /^(ENARE|USP|UNICAMP|UNIFESP|SUS-SP|PSU|UNESP|UFES|UFRJ|ISCMSP)\s*\d{4}[^A-Za-zÀ-ú]*/i,
    /^Medway\s*[-–]\s*\w+\s*[-–]\s*\d{4}[^A-Za-zÀ-ú]*/i,
    /^Páginas?\s*\d+\/\d+\s*/i,
    /^A B C D E\s*/,                                  // "A B C D E" header
    /^[A-E]\s+[A-E]\s+[A-E]\s+/,                    // "A B C D E" scattered
];

function cleanOption(text: string | null): string | null {
    if (!text) return text;
    let cleaned = text;

    for (const pattern of GARBAGE_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Clean trailing garbage: loose numbers, dots
    cleaned = cleaned.replace(/\s+\d+\.\s*$/, '');
    cleaned = cleaned.replace(/\s+\d+\s*$/, '');
    cleaned = cleaned.trim();

    // If we cleaned everything away, the data is unsalvageable
    if (cleaned.length < 2) return null;

    return cleaned;
}

function cleanStem(text: string | null): string {
    if (!text) return '';
    let cleaned = text;

    // Remove start-of-text garbage
    for (const pattern of STEM_START_GARBAGE) {
        cleaned = cleaned.replace(pattern, '');
    }

    // Remove garbage from end too
    for (const pattern of GARBAGE_PATTERNS) {
        cleaned = cleaned.replace(pattern, '');
    }

    cleaned = cleaned.trim();
    return cleaned;
}

async function fix() {
    console.log('\n══════════════════════════════════════════════');
    console.log('  DEFINITIVE CLEANUP — ALL QUESTION CORRUPTION');
    console.log('══════════════════════════════════════════════\n');

    const { rows: questions } = await query('SELECT * FROM questions');
    console.log(`Total questions: ${questions.length}\n`);

    let stemFixed = 0;
    let optionsFixed = 0;
    let totalUpdates = 0;

    for (const q of questions) {
        const updates: Record<string, any> = {};

        // Clean stem
        const cleanedStem = cleanStem(q.stem);
        if (cleanedStem !== (q.stem || '')) {
            updates.stem = cleanedStem;
            stemFixed++;
        }

        // Clean all options
        for (const col of ['option_a', 'option_b', 'option_c', 'option_d', 'option_e']) {
            const original = q[col];
            const cleaned = cleanOption(original);
            if (cleaned !== original) {
                updates[col] = cleaned;
                optionsFixed++;
            }
        }

        // Apply updates
        if (Object.keys(updates).length > 0) {
            const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
            const values = Object.values(updates);
            await query(
                `UPDATE questions SET ${setClauses.join(', ')} WHERE id = $1`,
                [q.id, ...values]
            );
            totalUpdates++;
        }
    }

    console.log('📊 RESULTS:');
    console.log(`  Stems fixed: ${stemFixed}`);
    console.log(`  Options fixed: ${optionsFixed}`);
    console.log(`  Questions updated: ${totalUpdates}/${questions.length}`);

    // Verify: check for remaining garbage
    console.log('\n🔍 POST-CLEANUP VERIFICATION...\n');

    const checks = [
        { name: 'GABARITO in any option', sql: `SELECT COUNT(*) as c FROM questions WHERE option_a LIKE '%GABARITO%' OR option_b LIKE '%GABARITO%' OR option_c LIKE '%GABARITO%' OR option_d LIKE '%GABARITO%' OR option_e LIKE '%GABARITO%'` },
        { name: 'Medway in any option', sql: `SELECT COUNT(*) as c FROM questions WHERE option_a LIKE '%Medway%' OR option_b LIKE '%Medway%' OR option_c LIKE '%Medway%' OR option_d LIKE '%Medway%' OR option_e LIKE '%Medway%'` },
        { name: 'Páginas in any option', sql: `SELECT COUNT(*) as c FROM questions WHERE option_a LIKE '%Páginas%' OR option_b LIKE '%Páginas%' OR option_c LIKE '%Páginas%' OR option_d LIKE '%Páginas%' OR option_e LIKE '%Páginas%'` },
        { name: 'GABARITO in stem', sql: `SELECT COUNT(*) as c FROM questions WHERE stem LIKE '%GABARITO%'` },
        { name: 'Medway in stem', sql: `SELECT COUNT(*) as c FROM questions WHERE stem LIKE '%Medway%'` },
        { name: 'Long option_e (>200 chars)', sql: `SELECT COUNT(*) as c FROM questions WHERE LENGTH(option_e) > 200` },
        { name: 'Null option_a (broken)', sql: `SELECT COUNT(*) as c FROM questions WHERE option_a IS NULL` },
    ];

    let allClean = true;
    for (const check of checks) {
        const { rows: [{ c }] } = await query(check.sql);
        const ok = parseInt(c) === 0;
        console.log(`  ${ok ? '✅' : '⚠️'} ${check.name}: ${c}`);
        if (!ok) allClean = false;
    }

    // Sample 3 questions to show they're clean now
    console.log('\n🔬 SAMPLE AFTER CLEANUP:');
    const { rows: samples } = await query(`
        SELECT q.stem, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.correct_option,
               d.institution, d.year as doc_year
        FROM questions q JOIN documents d ON q.document_id = d.id
        ORDER BY RANDOM() LIMIT 3
    `);
    samples.forEach((q, i) => {
        console.log(`\n  ━━━ Sample ${i + 1} (${q.institution} ${q.doc_year}) ━━━`);
        console.log(`  STEM: ${(q.stem || '').substring(0, 150)}`);
        console.log(`  A: ${(q.option_a || '<null>').substring(0, 80)}`);
        console.log(`  B: ${(q.option_b || '<null>').substring(0, 80)}`);
        console.log(`  C: ${(q.option_c || '<null>').substring(0, 80)}`);
        console.log(`  D: ${(q.option_d || '<null>').substring(0, 80)}`);
        console.log(`  E: ${(q.option_e || '<null>').substring(0, 80)}`);
        console.log(`  CORRECT: ${q.correct_option}`);
    });

    console.log(`\n══ ${allClean ? '✅ ALL CLEAN!' : '⚠️ Some issues remain'} ══\n`);
    process.exit(0);
}

fix().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
