
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
        console.log('--- Inspecting Constraints for Documents ---');
        const res = await pool.query(`
        SELECT conname, pg_get_constraintdef(c.oid) 
        FROM pg_constraint c 
        JOIN pg_namespace n ON n.oid = c.connamespace 
        WHERE n.nspname = 'public' AND contype = 'u' AND conrelid = 'documents'::regclass;
    `);
        console.log('UNIQUE CONSTRAINTS:', res.rows);
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
