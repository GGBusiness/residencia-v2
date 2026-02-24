/**
 * Deep check on question data quality.
 * Run: npx tsx scripts/check-question-quality.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

async function check() {
    console.log('\n══════════════════════════════════════════');
    console.log('  QUALIDADE DAS QUESTÕES');
    console.log('══════════════════════════════════════════\n');

    // 1. Check stems that start mid-sentence (no capital letter, starts with lowercase or number)
    const { rows: badStems } = await query(`
        SELECT q.id, q.number_in_exam, LEFT(q.stem, 100) as stem_start,
               d.title as doc,
               LENGTH(q.stem) as stem_len
        FROM questions q
        JOIN documents d ON q.document_id = d.id
        ORDER BY d.title, q.number_in_exam
        LIMIT 20
    `);
    console.log('📝 SAMPLE STEMS (first 20):');
    badStems.forEach((q, i) => {
        console.log(`  ${i + 1}. [#${q.number_in_exam || '?'}] (${q.stem_len} chars) ${q.stem_start}...`);
    });

    // 2. Check option_e that contains next question text
    const { rows: bleedingOptions } = await query(`
        SELECT q.id, q.number_in_exam, LEFT(q.option_e, 200) as opt_e,
               d.title as doc
        FROM questions q
        JOIN documents d ON q.document_id = d.id
        WHERE q.option_e IS NOT NULL AND LENGTH(q.option_e) > 150
        LIMIT 10
    `);
    console.log(`\n⚠️  OPTION E com texto muito longo (possível bleeding): ${bleedingOptions.length}`);
    bleedingOptions.forEach((q, i) => {
        console.log(`  ${i + 1}. [#${q.number_in_exam}] E: ${q.opt_e.substring(0, 120)}...`);
    });

    // 3. Check stems that are very short (possibly truncated)
    const { rows: shortStems } = await query(`
        SELECT COUNT(*) as c FROM questions WHERE LENGTH(stem) < 50
    `);
    console.log(`\n📏 Stems curtos (<50 chars): ${shortStems[0].c}`);

    // 4. Check stems that are very long (possibly contains multiple questions)
    const { rows: longStems } = await query(`
        SELECT COUNT(*) as c FROM questions WHERE LENGTH(stem) > 500
    `);
    console.log(`📏 Stems longos (>500 chars): ${longStems[0].c}`);

    // 5. Check if option_e contains "QUESTÃO" (bleeding)
    const { rows: bleedCount } = await query(`
        SELECT COUNT(*) as c FROM questions
        WHERE option_e LIKE '%QUESTÃO%' OR option_e LIKE '%Questão%' OR option_e LIKE '%questão%'
    `);
    console.log(`\n🩸 option_e com "QUESTÃO" (bleeding): ${bleedCount[0].c}`);

    // 6. Check stems containing "QUESTÃO" in the middle (possible concatenation)
    const { rows: stemBleed } = await query(`
        SELECT COUNT(*) as c FROM questions
        WHERE stem LIKE '%QUESTÃO%' OR stem LIKE '%Questão%'
    `);
    console.log(`🩸 stems com "QUESTÃO" interno: ${stemBleed[0].c}`);

    // 7. Per-document question counts
    console.log('\n📄 QUESTÕES POR DOCUMENTO:');
    const { rows: perDoc } = await query(`
        SELECT d.title, d.institution, d.year, COUNT(q.id) as q_count,
               AVG(LENGTH(q.stem))::int as avg_stem_len,
               COUNT(CASE WHEN q.option_e IS NOT NULL AND LENGTH(q.option_e) > 150 THEN 1 END) as bleeding_count
        FROM documents d
        JOIN questions q ON q.document_id = d.id
        GROUP BY d.id, d.title, d.institution, d.year
        ORDER BY d.year DESC, d.title
    `);
    perDoc.forEach(d => {
        console.log(`  ${d.institution} ${d.year} | ${d.q_count} questões | avg_stem=${d.avg_stem_len} | bleeding=${d.bleeding_count} | ${d.title}`);
    });

    console.log('\n══════════════════════════════════════════\n');
    process.exit(0);
}

check().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
