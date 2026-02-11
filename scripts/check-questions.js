
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
        console.log('--- Checking Questions Table ---');

        const instRes = await pool.query('SELECT DISTINCT institution FROM questions WHERE institution IS NOT NULL');
        console.log('INSTITUTIONS:', instRes.rows.map(r => r.institution));

        const areaRes = await pool.query('SELECT DISTINCT area FROM questions WHERE area IS NOT NULL');
        console.log('AREAS:', areaRes.rows.map(r => r.area));

        const yearRes = await pool.query('SELECT DISTINCT year FROM questions WHERE year IS NOT NULL ORDER BY year DESC');
        console.log('YEARS:', yearRes.rows.map(r => r.year));

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
