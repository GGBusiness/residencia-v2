/**
 * DEEP DATA AUDIT: Examine ALL question data patterns to find every corruption type
 * Run: npx tsx scripts/deep-audit-questions.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

async function audit() {
    console.log('\n══════════════════════════════════════════');
    console.log('  DEEP AUDIT — ALL QUESTION DATA PATTERNS');
    console.log('══════════════════════════════════════════\n');

    const { rows: questions } = await query(`
        SELECT q.*, d.title as doc_title, d.institution, d.year as doc_year
        FROM questions q
        JOIN documents d ON q.document_id = d.id
        ORDER BY d.title, q.number_in_exam
    `);

    console.log(`Total questions: ${questions.length}\n`);

    // Pattern detection
    const issues: { id: string; field: string; issue: string; sample: string }[] = [];
    const patterns = {
        gabarito_in_options: 0,
        paginas_in_options: 0,
        medway_in_options: 0,
        long_option_e: 0,
        stem_starts_truncated: 0,
        stem_has_garbage: 0,
        option_a_garbage: 0,
        missing_correct_option: 0,
        correct_option_invalid: 0,
        empty_stem: 0,
        empty_options: 0,
    };

    for (const q of questions) {
        // Check each option for known garbage patterns
        const optionCols = ['option_a', 'option_b', 'option_c', 'option_d', 'option_e'];
        for (const col of optionCols) {
            const val = q[col] || '';

            if (val.includes('GABARITO') || val.includes('gabarito') || val.includes('Gabarito')) {
                patterns.gabarito_in_options++;
                issues.push({ id: q.id, field: col, issue: 'GABARITO in option', sample: val.substring(0, 120) });
            }
            if (val.includes('Páginas') || val.includes('Página') || val.includes('páginas')) {
                patterns.paginas_in_options++;
                issues.push({ id: q.id, field: col, issue: 'Páginas in option', sample: val.substring(0, 120) });
            }
            if (val.includes('Medway') || val.includes('medway')) {
                patterns.medway_in_options++;
                issues.push({ id: q.id, field: col, issue: 'Medway in option', sample: val.substring(0, 120) });
            }
            if (col === 'option_e' && val.length > 200) {
                patterns.long_option_e++;
            }
            if (!val && col !== 'option_e') {
                patterns.empty_options++;
                issues.push({ id: q.id, field: col, issue: 'Empty required option', sample: '' });
            }
        }

        // Check stem
        const stem = q.stem || '';
        if (!stem || stem.length < 10) {
            patterns.empty_stem++;
            issues.push({ id: q.id, field: 'stem', issue: 'Empty/very short stem', sample: stem });
        }
        if (/^\d/.test(stem) || /^[a-z]/.test(stem) || /^[.,;:\-\/]/.test(stem) || /^U\/L/.test(stem)) {
            patterns.stem_starts_truncated++;
            issues.push({ id: q.id, field: 'stem', issue: 'Starts truncated', sample: stem.substring(0, 100) });
        }
        if (stem.includes('Medway') || stem.includes('Páginas') || stem.includes('GABARITO')) {
            patterns.stem_has_garbage++;
            issues.push({ id: q.id, field: 'stem', issue: 'Contains garbage', sample: stem.substring(0, 100) });
        }

        // Check correct_option
        if (!q.correct_option) {
            patterns.missing_correct_option++;
        }
        if (q.correct_option && !['A', 'B', 'C', 'D', 'E'].includes(q.correct_option.toUpperCase())) {
            patterns.correct_option_invalid++;
            issues.push({ id: q.id, field: 'correct_option', issue: 'Invalid value', sample: q.correct_option });
        }
    }

    // Print patterns
    console.log('📊 PATTERN SUMMARY:');
    for (const [key, val] of Object.entries(patterns)) {
        const pct = ((val / questions.length) * 100).toFixed(1);
        const icon = val === 0 ? '✅' : val > questions.length * 0.1 ? '🔴' : '⚠️';
        console.log(`  ${icon} ${key}: ${val} (${pct}%)`);
    }

    // Print unique issue types with sample
    console.log('\n📋 SAMPLE ISSUES (first 3 of each type):');
    const issueTypes = [...new Set(issues.map(i => i.issue))];
    for (const type of issueTypes) {
        const typeIssues = issues.filter(i => i.issue === type);
        console.log(`\n  ── ${type} (${typeIssues.length} total) ──`);
        typeIssues.slice(0, 3).forEach(i => {
            console.log(`    ${i.field}: "${i.sample}"`);
        });
    }

    // Print per-document breakdown
    console.log('\n📄 PER-DOCUMENT ISSUE COUNT:');
    const byDoc: Record<string, number> = {};
    for (const q of questions) {
        const key = `${q.institution} ${q.doc_year} - ${q.doc_title}`;
        byDoc[key] = (byDoc[key] || 0);
    }
    // Count issues per document
    for (const i of issues) {
        const q = questions.find(q => q.id === i.id);
        if (q) {
            const key = `${q.institution} ${q.doc_year} - ${q.doc_title}`;
            byDoc[key] = (byDoc[key] || 0) + 1;
        }
    }
    for (const [doc, count] of Object.entries(byDoc).sort((a, b) => b[1] - a[1])) {
        if (count > 0) console.log(`  ${count} issues — ${doc}`);
    }

    // Print a few FULL questions for visual inspection
    console.log('\n\n🔬 FULL QUESTION SAMPLES (3 random):');
    const sampleIds = [0, Math.floor(questions.length / 2), questions.length - 1];
    for (const idx of sampleIds) {
        const q = questions[idx];
        console.log(`\n  ━━━ Q#${q.number_in_exam || idx} (${q.institution} ${q.doc_year}) ━━━`);
        console.log(`  STEM: ${(q.stem || '').substring(0, 200)}`);
        console.log(`  A: ${(q.option_a || '').substring(0, 100)}`);
        console.log(`  B: ${(q.option_b || '').substring(0, 100)}`);
        console.log(`  C: ${(q.option_c || '').substring(0, 100)}`);
        console.log(`  D: ${(q.option_d || '').substring(0, 100)}`);
        console.log(`  E: ${(q.option_e || '<null>').substring(0, 100)}`);
        console.log(`  CORRECT: ${q.correct_option}`);
        console.log(`  EXPLANATION: ${(q.explanation || '<none>').substring(0, 100)}`);
    }

    console.log(`\n\n══ TOTAL: ${issues.length} issues across ${questions.length} questions ══\n`);

    process.exit(0);
}

audit().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
