
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ ERRO: SUPABASE_SERVICE_ROLE_KEY ausente!");
    process.exit(1);
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: { persistSession: false }
    }
);

async function fixSchema() {
    console.log("🛠️ Iniciando Correção de Schema...");

    // 1. Adicionar colunas faltantes em 'documents'
    const sqlCommands = [
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type VARCHAR(50) DEFAULT 'general';`,
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_path TEXT;`,
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';`,
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS year INTEGER;`,
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS program VARCHAR(100);`,
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS institution VARCHAR(100);`,
        `ALTER TABLE documents ADD COLUMN IF NOT EXISTS area VARCHAR(100);`
    ];

    // Supabase JS client doesn't support running raw SQL directly via rpc unless a function exists.
    // However, if we don't have a 'exec_sql' function, we might be stuck.
    // BUT! We can try to use the 'pg' library if available, or...
    // WAIT. Standard Supabase client CANNOT run raw SQL unless there is a Postgres Function 'exec_sql' exposed.

    // Check if we can use the "postgres.js" or "pg" driver? 
    // The user's package.json likely doesn't have it.

    // ALTERNATIVE:
    // We can use the Supabase 'REST' API via the client to insert a dummy row to checking columns? No that fails.

    // Correct approach for Supabase without direct SQL access:
    // We usually need to use the Dashboard SQL Editor.

    // HOWEVER, I can try to see if there is an 'exec' function or similar.
    // If not, I will output the SQL and ask the user to run it in the dashboard.

    // Let's TRY to see if I can inspect the columns first to confirm.

    console.log("📋 Verificando colunas da tabela 'documents'...");

    const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .limit(1);

    if (docError) {
        console.error("❌ Erro ao ler tabela:", docError.message);
        // If the table doesn't exist at all?
        if (docError.message.includes('relation "documents" does not exist')) {
            console.error("😱 A tabela 'documents' NÃO EXISTE!");
        }
        return;
    }

    console.log("✅ Tabela acessível. Tentando identificar colunas...");
    // We can't easily see columns from an empty result if no rows exist.
    // But if we try to insert a dummy row with the new columns, we can see if it fails.

    console.log("⚠️ AVISO: O cliente JS do Supabase não roda 'ALTER TABLE'.");
    console.log("⚠️ Você precisa rodar o SQL abaixo no Painel do Supabase > SQL Editor:");
    console.log("\n" + sqlCommands.join("\n") + "\n");
}

fixSchema();
