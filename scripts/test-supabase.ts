
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log("🔍 Testando Conexão com Supabase...");
console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`KEY (Length): ${process.env.SUPABASE_SERVICE_ROLE_KEY?.length}`);

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

async function testConnection() {
    try {
        console.log("---------------------------------------------------");
        console.log("📡 Teste 1: Conectividade Geral (Google)...");
        try {
            await fetch('https://www.google.com', { method: 'HEAD' });
            console.log("✅ Internet OK (Google acessível).");
        } catch (e: any) {
            console.error("❌ SEM INTERNET: Falha ao acessar Google.", e.message);
        }

        console.log("---------------------------------------------------");
        console.log("📡 Teste 2: Analisando URL do Supabase...");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        console.log(`URL: '${url}'`);
        // Check for non-printable chars
        for (let i = 0; i < url.length; i++) {
            const code = url.charCodeAt(i);
            if (code < 33 || code > 126) {
                console.error(`⚠️ CARACTERE NVISÍVEL DETECTADO na posição ${i}: Código ${code}`);
            }
        }

        console.log("---------------------------------------------------");
        console.log("⏳ Teste 3: Buscando 1 documento no Supabase...");
        const start = Date.now();

        const { data, error } = await supabase
            .from('documents')
            .select('id')
            .limit(1);

        const duration = Date.now() - start;

        if (error) {
            console.error("❌ Erro no Supabase:", error);
            console.error("Detalhes:", error.message);
        } else {
            console.log(`✅ SUCESSO TOTAL! Conexão estabelecida em ${duration}ms.`);
            console.log("Dados retornados:", data);
        }

    } catch (err: any) {
        console.error("❌ ERRO FATAL (Network/Fetch):", err.message);
        if (err.cause) console.error("Causa:", err.cause);
    }
}

testConnection();
