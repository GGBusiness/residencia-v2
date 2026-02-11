
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DIGITALOCEAN_DB_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function check() {
    try {
        console.log('--- Inspecting Documents Table Schema ---');
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documents'");
        console.log('COLUMNS:', res.rows.map(r => `${r.column_name} (${r.data_type})`));
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
