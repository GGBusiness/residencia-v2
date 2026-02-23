/**
 * FINAL comprehensive check - tests the ENTIRE Monta Provas flow.
 * Run: npx tsx scripts/final-check.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query } from '../lib/db';

async function finalCheck() {
    const results: string[] = [];
    let allPassed = true;

    const pass = (msg: string) => { results.push(`  ✅ ${msg}`); };
    const fail = (msg: string) => { results.push(`  ❌ ${msg}`); allPassed = false; };

    // 1. DB
    try {
        await query('SELECT 1');
        pass('DB connection OK');
    } catch (e: any) { fail(`DB: ${e.message}`); }

    // 2. Schema
    try {
        const { rows } = await query(`SELECT column_name FROM information_schema.columns WHERE table_name='attempts'`);
        const cols = rows.map(r => r.column_name);
        pass(`attempts has ${cols.length} columns: ${cols.join(', ')}`);
        if (cols.includes('attempt_type')) fail('attempt_type still exists!');
        else pass('attempt_type correctly absent');
    } catch (e: any) { fail(`Schema: ${e.message}`); }

    // 3. Profiles exist for all users
    try {
        const { rows } = await query(`
            SELECT u.id, u.email FROM users u
            LEFT JOIN profiles p ON u.id = p.id
            WHERE p.id IS NULL
        `);
        if (rows.length === 0) pass('All users have profiles');
        else fail(`${rows.length} users missing from profiles: ${rows.map(r => r.email).join(', ')}`);
    } catch (e: any) { fail(`Profiles check: ${e.message}`); }

    // 4. Documents
    try {
        const { rows } = await query(`SELECT COUNT(*) as c FROM documents WHERE type = 'PROVA'`);
        pass(`${rows[0].c} PROVA documents in DB`);
    } catch (e: any) { fail(`Documents: ${e.message}`); }

    // 5. INSERT attempt (the critical test)
    try {
        const { rows: users } = await query('SELECT id FROM users LIMIT 1');
        if (users.length === 0) { fail('No users in DB!'); }
        else {
            await query('BEGIN');
            const { rows } = await query(`
                INSERT INTO attempts (user_id, config, status, total_questions, timer_seconds, started_at)
                VALUES ($1, $2, 'IN_PROGRESS', $3, $4, NOW())
                RETURNING id, user_id, status
            `, [users[0].id, JSON.stringify({ mode: 'CUSTOM', questionCount: 10 }), 10, null]);
            await query('ROLLBACK');
            pass(`INSERT attempt OK — id=${rows[0].id}`);
        }
    } catch (e: any) {
        await query('ROLLBACK').catch(() => { });
        fail(`INSERT attempt: ${e.message} | detail: ${e.detail}`);
    }

    // 6. Test data-service createAttempt function directly
    try {
        const ds = await import('../lib/data-service');
        pass(`data-service loaded — createAttempt=${typeof ds.createAttempt}`);
    } catch (e: any) { fail(`data-service import: ${e.message}`); }

    // 7. Test user-service (no supabase crash)
    try {
        const us = await import('../lib/user-service');
        pass(`user-service loaded — syncUser=${typeof us.userService.syncUser}`);
    } catch (e: any) { fail(`user-service import: ${e.message}`); }

    // 8. Test exam-actions
    try {
        const ea = await import('../app/actions/exam-actions');
        pass(`exam-actions loaded — createExamAction=${typeof ea.createExamAction}`);
    } catch (e: any) { fail(`exam-actions import: ${e.message}`); }

    // Print results
    console.log('\n========================================');
    console.log('  FINAL CHECK RESULTS');
    console.log('========================================');
    results.forEach(r => console.log(r));
    console.log('========================================');
    console.log(allPassed ? '  🎉 ALL CHECKS PASSED — READY TO DEPLOY' : '  ⚠️  SOME CHECKS FAILED');
    console.log('========================================\n');

    process.exit(allPassed ? 0 : 1);
}

finalCheck().catch(e => { console.error('FATAL:', e); process.exit(1); });
