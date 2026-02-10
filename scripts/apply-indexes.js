// Executa o SQL de criação de índices
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log('🚀 Criando índices de performance...');

    const sql = fs.readFileSync('scripts/create-indexes.sql', 'utf-8');

    // Supabase JS não executa SQL bruto diretamente sem RPC ou pg admin
    // Mas podemos tentar via RPC se houver uma função exec_sql
    // OU usar a conexão direta se tivéssemos a string de conexão postgresql://

    // Como alternativa segura, vamos apenas logs para o usuário rodar no painel
    // ou tentar usar uma tabela temporária se tivermos permissão de criação

    console.log('⚠️ A API JS do Supabase não executa DDL (CREATE INDEX) diretamente.');
    console.log('📋 Por favor, execute o seguinte SQL no Editor SQL do seu painel Supabase:');
    console.log('\n' + '='.repeat(50));
    console.log(sql);
    console.log('='.repeat(50) + '\n');

    console.log('Tentando via RPC "exec_sql" caso exista...');
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
        console.log('❌ RPC exec_sql não disponível (esperado).');
        console.log('👉 Use o painel do Supabase para rodar o SQL acima.');
    } else {
        console.log('✅ Índices criados com sucesso via RPC!');
    }
}

run();
