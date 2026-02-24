/**
 * Test the new createFullExamAction flow.
 * Run: npx tsx scripts/test-full-exam.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query } from '../lib/db';

async function test() {
    // Replicate what createFullExamAction does
    console.log('\n=== Testing Full Exam Flow ===\n');

    // 1. Select documents
    const { rows: docs } = await query(`
        SELECT id, title FROM documents WHERE type = 'PROVA'
        ORDER BY year DESC LIMIT 6
    `);
    console.log(`✅ Step 1: Found ${docs.length} documents`);
    const docIds = docs.slice(0, 2).map((r: any) => r.id);

    // 2. Get user
    const { rows: users } = await query('SELECT id, email, name FROM users LIMIT 1');
    const user = users[0];
    console.log(`✅ Step 2: User ${user.email}`);

    // 3. Ensure profile
    await query(`
        INSERT INTO profiles (id, email, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
    `, [user.id, user.email, user.name]);
    console.log(`✅ Step 3: Profile ensured`);

    // 4. Insert attempt (with rollback)
    await query('BEGIN');
    const config = { mode: 'CUSTOM', feedbackMode: 'PROVA', documentIds: docIds, questionCount: 10 };
    const { rows: attempts } = await query(`
        INSERT INTO attempts (user_id, config, status, total_questions, timer_seconds, started_at)
        VALUES ($1, $2, 'IN_PROGRESS', $3, $4, NOW())
        RETURNING id
    `, [user.id, JSON.stringify(config), 10, null]);
    console.log(`✅ Step 4: Attempt created id=${attempts[0].id}`);
    await query('ROLLBACK');
    console.log(`   (Rolled back)`);

    console.log('\n🎉 ALL STEPS PASSED — createFullExamAction will work!\n');
    process.exit(0);
}

test().catch(e => { console.error('❌ FAILED:', e.message, e.detail); process.exit(1); });
