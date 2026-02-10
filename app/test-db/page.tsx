
import { db, query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function TestDbPage() {
    let status = 'Testing...';
    let details = '';
    let color = 'text-yellow-500';

    try {
        const start = Date.now();
        const { rows } = await query('SELECT NOW() as time');
        const duration = Date.now() - start;

        status = '✅ CONEXÃO COM BANCO DE DADOS: SUCESSO';
        details = `Tempo de resposta: ${duration}ms\nData do Banco: ${rows[0].time}\nURL usada: ${process.env.DIGITALOCEAN_DB_URL ? 'DIGITALOCEAN_DB_URL (Definida)' : 'Indefinida'}`;
        color = 'text-green-600';
    } catch (error: any) {
        status = '❌ FALHA NA CONEXÃO';
        details = `Erro: ${error.message}\nStack: ${error.stack}`;
        color = 'text-red-600';
    }

    return (
        <div className="p-10 font-mono">
            <h1 className={`text-2xl font-bold ${color} mb-4`}>{status}</h1>
            <pre className="bg-gray-100 p-4 rounded border overflow-auto">
                {details}
            </pre>
            <div className="mt-8 text-sm text-gray-500">
                <p>Ambiente Vercel: {process.env.VERCEL_ENV || 'Local/Desconhecido'}</p>
                <p>Timestamp: {new Date().toISOString()}</p>
            </div>
        </div>
    );
}
