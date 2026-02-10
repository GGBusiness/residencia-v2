import { Pool } from 'pg';

let pool: Pool | null = null;

if (!process.env.DIGITALOCEAN_DB_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ DIGITALOCEAN_DB_URL is not set. Database features will fail.');
}

// Configuração do Pool de Conexões (Singleton)
// Em serverless (Vercel), é importante gerenciar isso para não estourar conexões.
// O erro "self-signed certificate in certificate chain" no Vercel/DigitalOcean
// geralmente exige que o Node ignore completamente a verificação de TLS em produção.
if (process.env.NODE_ENV === 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

if (!pool) {
  console.log('🌐 [lib/db] Initializing connection pool (Aggressive SSL Fix)...');

  // Limpar a connection string de qualquer conflito de sslmode
  let connectionString = process.env.DIGITALOCEAN_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || '';

  if (connectionString.includes('sslmode=require')) {
    connectionString = connectionString.replace('sslmode=require', 'sslmode=no-verify');
  } else if (!connectionString.includes('sslmode=')) {
    const separator = connectionString.includes('?') ? '&' : '?';
    connectionString += `${separator}sslmode=no-verify`;
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false, // redundante mas garantido
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  pool.on('error', (err) => {
    console.error('❌ [lib/db] Pool Error:', err.message);
  });

  console.log('✅ [lib/db] Pool created with Aggressive SSL parameters.');
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
