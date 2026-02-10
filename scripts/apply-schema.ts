import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';

// Configurar permissão TLS para dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
    console.log('🏗️  Aplicando Schema de Usuários no DigitalOcean...');

    // Import dinâmico
    const { query } = await import('../lib/db');

    try {
        const sqlPath = path.join(process.cwd(), 'scripts', 'setup-user-schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split commands (simple split via regex usually works for simple schemas)
        // Mas o driver 'pg' suporta multiplos comandos numa string se configurado, 
        // ou podemos usar chamadas sequenciais.
        // Vamos rodar tudo junto.

        await query(sql);

        console.log('✅ Schema aplicado com sucesso!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Erro ao aplicar schema:', e);
        process.exit(1);
    }
}

main();
