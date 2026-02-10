import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import path from 'path';

// Config: Fix para certificados auto-assinados
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function migrate() {
    const { db } = await import('../lib/db');

    console.log('🧠 Configurando Cérebro Vetorial (pgvector)...');

    try {
        const sqlPath = path.join(process.cwd(), 'setup-rag.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split commands loosely by semicolon to execute individually if needed, 
        // or just run the whole block if the driver supports multiple statements.
        // 'pg' driver support multiple statements in a single query usually.
        await db.query(sql);

        console.log('✅ Tabelas de vetores criadas com sucesso!');

    } catch (error) {
        console.error('❌ Erro na configuração do RAG:', error);
    } finally {
        process.exit(0);
    }
}

migrate();
