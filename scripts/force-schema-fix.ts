
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load ecosystem env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function fixSchema() {
    const connectionString = process.env.DIGITALOCEAN_DB_URL;
    if (!connectionString) {
        console.error('❌ DIGITALOCEAN_DB_URL not found in .env.local');
        process.exit(1);
    }

    console.log('🔌 Connecting to DB...');
    const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('✅ Connected.');

        // 1. Check columns
        console.log('🔍 Checking attempts table columns...');
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'attempts'
        `);

        const columns = res.rows.map(r => r.column_name);
        console.log('📋 Existing columns:', columns.join(', '));

        const missingCols = [];
        if (!columns.includes('percentage')) missingCols.push('percentage NUMERIC');
        if (!columns.includes('correct_answers')) missingCols.push('correct_answers INTEGER');
        if (!columns.includes('timer_seconds')) missingCols.push('timer_seconds INTEGER');

        if (missingCols.length > 0) {
            console.log('⚠️ Missing columns found:', missingCols);
            for (const colDef of missingCols) {
                const sql = `ALTER TABLE attempts ADD COLUMN IF NOT EXISTS ${colDef}`;
                console.log(`🛠️ Executing: ${sql}`);
                await client.query(sql);
            }
            console.log('✅ Columns added successfully.');
        } else {
            console.log('✅ All required columns already exist.');
        }

        // 2. Verify again
        const res2 = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'attempts' AND column_name IN ('percentage', 'correct_answers', 'timer_seconds')
        `);
        console.log('✅ Verified presence:', res2.rows.map(r => r.column_name));

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await pool.end();
    }
}

fixSchema();
