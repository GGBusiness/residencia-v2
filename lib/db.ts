import { Pool } from 'pg';

let pool: Pool | null = null;

if (!process.env.DIGITALOCEAN_DB_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ DIGITALOCEAN_DB_URL is not set. Database features will fail.');
}

// Configuração do Pool de Conexões (Singleton)
// Em serverless (Vercel), é importante gerenciar isso para não estourar conexões.
// O erro "self-signed certificate in certificate chain" no Vercel/DigitalOcean
// geralmente exige que o Node ignore completamente a verificação de TLS em produção.
// Forçar o Node a ignorar erros de certificado auto-assinado (DigitalOcean)
// Fazemos isso em todos os ambientes pois o banco é o mesmo.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

if (!pool) {
  console.log('🌐 [lib/db] Initializing connection pool...');

  // Tentar carregar dotenv se estiver em scripts (onde o Next não carrega automaticamente)
  if (!process.env.DIGITALOCEAN_DB_URL) {
    try {
      const dotenv = require('dotenv');
      const path = require('path');
      dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
    } catch (e) {
      // Ignorar se falhar (ex: no browser, mas esse arquivo só roda no server)
    }
  }

  const connectionString = process.env.DIGITALOCEAN_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';

  if (!connectionString) {
    console.warn('⚠️ [lib/db] No connection string found! Database will fail.');
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  pool.on('error', (err) => {
    console.error('❌ [lib/db] Pool Error:', err.message);
  });

  console.log('✅ [lib/db] Pool created.');
}



export const db = pool!;

// Helper para queries simples
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool!.query(text, params);
    const duration = Date.now() - start;
    // console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database Error:', error);
    throw error;
  }
}
