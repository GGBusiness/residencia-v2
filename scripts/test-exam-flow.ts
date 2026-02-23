/**
 * Test script to reproduce the exact exam creation flow and see the REAL error.
 * Run with: npx tsx scripts/test-exam-flow.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query } from '../lib/db';

async function testExamFlow() {
    console.log('\n=== STEP 1: DB Connection ===');
    try {
        const { rows } = await query('SELECT NOW() as now, version() as version');
        console.log('✅ DB OK:', rows[0].now);
    } catch (e: any) {
        console.error('❌ DB FAIL:', e.message);
        process.exit(1);
    }

    console.log('\n=== STEP 2: Check attempts table columns ===');
    try {
        const { rows } = await query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'attempts'
            ORDER BY ordinal_position
        `);
        console.log('Columns:');
        rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type}, nullable=${r.is_nullable}, default=${r.column_default})`));

        // Check for required columns
        const colNames = rows.map(r => r.column_name);
        const required = ['id', 'user_id', 'config', 'status', 'total_questions', 'started_at'];
        for (const col of required) {
            if (!colNames.includes(col)) {
                console.error(`❌ MISSING COLUMN: ${col}`);
            }
        }
    } catch (e: any) {
        console.error('❌ Schema check FAIL:', e.message);
    }

    console.log('\n=== STEP 3: Check users table ===');
    try {
        const { rows } = await query('SELECT id, email, name FROM users LIMIT 3');
        console.log(`✅ Found ${rows.length} users:`);
        rows.forEach(u => console.log(`  - ${u.id} (${u.email})`));
    } catch (e: any) {
        console.error('❌ Users check FAIL:', e.message);
    }

    console.log('\n=== STEP 4: Check foreign key constraints on attempts ===');
    try {
        const { rows } = await query(`
            SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_name = 'attempts' AND tc.constraint_type = 'FOREIGN KEY'
        `);
        console.log('Foreign keys:');
        rows.forEach(r => console.log(`  - ${r.column_name} → ${r.foreign_table} (${r.constraint_name})`));
        if (rows.length === 0) console.log('  (none)');
    } catch (e: any) {
        console.error('❌ FK check FAIL:', e.message);
    }

    console.log('\n=== STEP 5: Select documents (like pdf-selector) ===');
    let docIds: string[] = [];
    try {
        const { rows } = await query(`
            SELECT id, title, institution, year, type
            FROM documents WHERE type = 'PROVA'
            ORDER BY year DESC LIMIT 5
        `);
        console.log(`✅ Found ${rows.length} PROVA documents:`);
        rows.forEach(d => {
            console.log(`  - ${d.id} | ${d.title} | ${d.institution} | ${d.year}`);
            docIds.push(d.id);
        });
    } catch (e: any) {
        console.error('❌ Document selection FAIL:', e.message);
    }

    console.log('\n=== STEP 6: Test INSERT into attempts ===');
    try {
        // Get first user to test with
        const { rows: users } = await query('SELECT id FROM users LIMIT 1');
        if (users.length === 0) {
            console.error('❌ No users found! Cannot test INSERT.');
        } else {
            const testUserId = users[0].id;
            const testConfig = {
                mode: 'CUSTOM',
                feedbackMode: 'PROVA',
                documentIds: docIds,
                questionCount: 10
            };

            await query('BEGIN');
            const { rows } = await query(`
                INSERT INTO attempts (user_id, config, status, total_questions, timer_seconds, started_at)
                VALUES ($1, $2, 'IN_PROGRESS', $3, $4, NOW())
                RETURNING *
            `, [testUserId, JSON.stringify(testConfig), 10, null]);

            console.log('✅ INSERT succeeded!');
            console.log('  Result:', JSON.stringify(rows[0]).substring(0, 300));

            // Check serialization
            const serialized = JSON.parse(JSON.stringify(rows[0]));
            console.log('✅ Serialization OK');
            console.log('  Serialized keys:', Object.keys(serialized).join(', '));

            await query('ROLLBACK');
            console.log('  (Rolled back - no test data saved)');
        }
    } catch (e: any) {
        await query('ROLLBACK').catch(() => { });
        console.error('❌ INSERT FAIL:', e.message);
        console.error('  Code:', e.code);
        console.error('  Detail:', e.detail);
        console.error('  Stack:', e.stack?.substring(0, 300));
    }

    console.log('\n=== STEP 7: Test user-service import ===');
    try {
        const { userService } = await import('../lib/user-service');
        console.log('✅ user-service imported OK');
        console.log('  Has syncUser:', typeof userService.syncUser);
    } catch (e: any) {
        console.error('❌ user-service import FAIL:', e.message);
        console.error('  Stack:', e.stack?.substring(0, 300));
    }

    console.log('\n=== STEP 8: Test data-service import ===');
    try {
        const ds = await import('../lib/data-service');
        console.log('✅ data-service imported OK');
        console.log('  Has createAttempt:', typeof ds.createAttempt);
    } catch (e: any) {
        console.error('❌ data-service import FAIL:', e.message);
        console.error('  Stack:', e.stack?.substring(0, 300));
    }

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

testExamFlow().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
