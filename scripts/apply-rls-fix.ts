
import { db } from '../lib/db';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function applyRLSMigration() {
    try {
        console.log('🛡️ Applying RLS Fix Migration...');

        const sqlPath = path.resolve(__dirname, '../supabase/migrations/20260212_fix_planner_rls.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📂 SQL File loaded.');

        await db.query(sql);

        console.log('✅ Migration applied successfully! RLS policies are now active for Planner tables.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

applyRLSMigration();
