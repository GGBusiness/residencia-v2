
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DIGITALOCEAN_DB_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function check() {
    console.log('--- Checking Database Tables ---');
    try {
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
        console.log('Tables found:', res.rows.map(r => r.table_name));

        // Check specific tables
        const required = ['users', 'user_profiles', 'user_goals'];
        const missing = required.filter(t => !res.rows.find(r => r.table_name === t));

        if (missing.length > 0) {
            console.error('❌ MISSING TABLES:', missing);
        } else {
            console.log('✅ All required tables for onboarding exist.');
        }

        // Check columns
        for (const table of required) {
            const colRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1", [table]);
            console.log(`\n--- Columns for ${table} ---`);
            console.log(colRes.rows.map(r => `${r.column_name} (${r.data_type})`));
        }
    } catch (err) {
        console.error('❌ Database error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
