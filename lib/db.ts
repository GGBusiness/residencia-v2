import { Pool } from 'pg';

let pool: Pool | null = null;

if (!process.env.DIGITALOCEAN_DB_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ DIGITALOCEAN_DB_URL is not set. Database features will fail.');
}

// Configuração do Pool de Conexões (Singleton)
// Em serverless (Vercel), é importante gerenciar isso para não estourar conexões.
if (!pool) {
  pool = new Pool({
    connectionString: process.env.DIGITALOCEAN_DB_URL,
    ssl: {
      rejectUnauthorized: false // Necessário para DigitalOcean (self-signed certs)
    },
    max: 10, // Limite de conexões simultâneas
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
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
