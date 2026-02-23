/**
 * Fix: Ensure all users in `users` table also exist in `profiles` table.
 * The FK on `attempts.user_id` references `profiles`, not `users`.
 * Run: npx tsx scripts/fix-profiles-fk.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { query } from '../lib/db';

async function fix() {
    console.log('\n=== 1. Check profiles table schema ===');
    const { rows: cols } = await query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        ORDER BY ordinal_position
    `);
    console.log('Profiles columns:');
    cols.forEach(r => console.log(`  - ${r.column_name} (${r.data_type}, nullable=${r.is_nullable})`));

    console.log('\n=== 2. Check existing profiles ===');
    const { rows: profiles } = await query('SELECT id, email FROM profiles LIMIT 5');
    console.log(`Found ${profiles.length} profiles`);
    profiles.forEach(p => console.log(`  - ${p.id} (${p.email})`));

    console.log('\n=== 3. Check users NOT in profiles ===');
    const { rows: missing } = await query(`
        SELECT u.id, u.email, u.name
        FROM users u
        LEFT JOIN profiles p ON u.id = p.id
        WHERE p.id IS NULL
    `);
    console.log(`Users missing from profiles: ${missing.length}`);
    missing.forEach(u => console.log(`  - ${u.id} (${u.email}) — ${u.name}`));

    if (missing.length > 0) {
        console.log('\n=== 4. Inserting missing users into profiles ===');
        for (const u of missing) {
            try {
                // Try with all common columns, falling back on error
                await query(`
                    INSERT INTO profiles (id, email, name)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (id) DO NOTHING
                `, [u.id, u.email, u.name]);
                console.log(`  ✅ Inserted: ${u.email}`);
            } catch (e: any) {
                // If email/name columns don't exist, try just id
                console.log(`  ⚠️ Failed with 3 columns (${e.message}), trying id only...`);
                try {
                    await query(`INSERT INTO profiles (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [u.id]);
                    console.log(`  ✅ Inserted (id only): ${u.id}`);
                } catch (e2: any) {
                    console.error(`  ❌ Failed: ${e2.message}`);
                }
            }
        }
    }

    console.log('\n=== 5. Verify: Test INSERT into attempts ===');
    try {
        const { rows: users } = await query('SELECT id FROM users LIMIT 1');
        const testUserId = users[0].id;

        await query('BEGIN');
        const { rows } = await query(`
            INSERT INTO attempts (user_id, config, status, total_questions, started_at)
            VALUES ($1, $2, 'IN_PROGRESS', $3, NOW())
            RETURNING id, user_id, status
        `, [testUserId, JSON.stringify({ mode: 'TEST' }), 10]);

        console.log('✅ INSERT into attempts SUCCEEDED!');
        console.log('  Result:', JSON.stringify(rows[0]));

        await query('ROLLBACK');
        console.log('  (Rolled back)');
    } catch (e: any) {
        await query('ROLLBACK').catch(() => { });
        console.error('❌ INSERT STILL FAILING:', e.message);
        console.error('  Detail:', e.detail);
    }

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

fix().catch(e => { console.error('FATAL:', e); process.exit(1); });
