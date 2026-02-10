const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Fix para erro de certificado auto-assinado da DigitalOcean
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

if (!process.env.DIGITALOCEAN_DB_URL) {
    console.error('❌ Erro: DIGITALOCEAN_DB_URL não encontrado no .env.local');
    console.error('Adicione a connection string ao arquivo .env.local e tente novamente.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DIGITALOCEAN_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    console.log('🚀 Iniciando Migração do Schema...');

    try {
        const schemaPath = path.join(__dirname, '..', 'setup-do-schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('📄 Lendo arquivo setup-do-schema.sql...');

        await pool.query(schemaSql);

        console.log('✅ Tabelas criadas com sucesso!');
        console.log('🐘 Banco de Dados pronto para uso.');

    } catch (error) {
        console.error('❌ Erro na migração:', error);
    } finally {
        await pool.end();
    }
}

migrate();
