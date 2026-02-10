import { Pool } from 'pg';

let pool: Pool | null = null;

if (!process.env.DIGITALOCEAN_DB_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ DIGITALOCEAN_DB_URL is not set. Database features will fail.');
}

// Configuração do Pool de Conexões (Singleton)
// Em serverless (Vercel), é importante gerenciar isso para não estourar conexões.
const isDO = process.env.DIGITALOCEAN_DB_URL?.includes('ondigitalocean.com');

if (!pool) {
  console.log('🌐 [lib/db] Initializing connection pool...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Database URL Source:',
    process.env.DIGITALOCEAN_DB_URL ? 'DIGITALOCEAN_DB_URL' :
      process.env.POSTGRES_URL ? 'POSTGRES_URL' :
        process.env.DATABASE_URL ? 'DATABASE_URL' : 'NONE'
  );

  const connectionString = process.env.DIGITALOCEAN_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Testar conexão imediatamente no startup do pool
  pool.on('error', (err) => {
    console.error('❌ [lib/db] Unexpected error on idle client:', err);
  });

  console.log('✅ [lib/db] Pool created with SSL rejectUnauthorized: false');
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
