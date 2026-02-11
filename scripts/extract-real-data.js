
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DIGITALOCEAN_DB_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function extract() {
    try {
        console.log('--- Extracting Real Data from Documents ---');

        const instRes = await pool.query('SELECT DISTINCT institution FROM documents WHERE institution IS NOT NULL ORDER BY institution');
        console.log('INSTITUTIONS:', instRes.rows.map(r => r.institution));

        // Check areas from questions table (better for questions)
        const areaRes = await pool.query('SELECT DISTINCT area FROM questions WHERE area IS NOT NULL ORDER BY area');
        console.log('AREAS (from questions):', areaRes.rows.map(r => r.area));

        const yearRes = await pool.query('SELECT DISTINCT year FROM documents WHERE year IS NOT NULL ORDER BY year DESC');
        console.log('YEARS:', yearRes.rows.map(r => r.year));

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await pool.end();
    }
}

extract();
