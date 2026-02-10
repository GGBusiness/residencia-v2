import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';

// Configurar permissão TLS para dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
    console.log('🏗️  Aplicando Schema de Quiz no DigitalOcean...');

    const { query } = await import('../lib/db');

    try {
        const sqlPath = path.join(process.cwd(), 'scripts', 'setup-quiz-schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await query(sql);

        console.log('✅ Schema de Quiz aplicado com sucesso!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Erro ao aplicar schema:', e);
        process.exit(1);
    }
}

main();
