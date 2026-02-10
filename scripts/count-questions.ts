import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Configurar permissão TLS para dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
    // Dynamic import to ensure env vars are loaded
    const { query } = await import('../lib/db');

    try {
        const { rows } = await query('SELECT count(*) as total FROM questions');
        console.log(`\n📊 Total de questões no banco: ${rows[0].total}\n`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
