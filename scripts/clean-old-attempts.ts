/**
 * Clean old attempts that have incorrect data (before correct_option fix)
 * Run: npx tsx scripts/clean-old-attempts.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { query } from '../lib/db';

async function main() {
    console.log('\n🧹 CLEANING OLD ATTEMPTS (incorrect gabarito data)\n');

    // Get counts before
    const { rows: before } = await query('SELECT COUNT(*) as count FROM attempts');
    const { rows: answersBefore } = await query('SELECT COUNT(*) as count FROM attempt_answers');
    console.log(`📊 Before: ${before[0].count} attempts, ${answersBefore[0].count} answers`);

    // Delete all attempt_answers first (foreign key)
    await query('DELETE FROM attempt_answers');
    console.log('✅ Deleted all attempt_answers');

    // Delete all attempts
    await query('DELETE FROM attempts');
    console.log('✅ Deleted all attempts');

    // Verify
    const { rows: after } = await query('SELECT COUNT(*) as count FROM attempts');
    console.log(`\n📊 After: ${after[0].count} attempts — Fresh start! 🎉`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
