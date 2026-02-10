import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Config: Fix para certificados auto-assinados (DB)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function migrate() {
    // Importação dinâmica do DB
    const { db } = await import('../lib/db');

    console.log('🔄 Atualizando Schema da Tabela Profiles (Users)...');

    try {
        // 1. Adicionar colunas faltantes se não existirem
        await db.query(`
            ALTER TABLE public.profiles 
            ADD COLUMN IF NOT EXISTS phone TEXT,
            ADD COLUMN IF NOT EXISTS age INTEGER,
            ADD COLUMN IF NOT EXISTS goal TEXT;
        `);
        console.log('✅ Colunas (phone, age, goal) adicionadas.');

        // 2. Criar tabela pública 'users' se o app insiste em usar esse nome
        // (Fazemos uma View ou Tabela Real? Vamos fazer Tabela Real para simplificar migracao)
        // Se 'profiles' já existe, vamos manter profiles e criar uma view ou só usar profiles.
        // O código do frontend tenta ler 'users'. Vamos criar 'users' como alias ou tabela separada?
        // Melhor: Vamos criar a tabela 'users' se ela não existir, compátivel com o signup.

        await db.query(`
            CREATE TABLE IF NOT EXISTS public.users (
                id UUID PRIMARY KEY, -- FK para Auth
                email TEXT,
                name TEXT,
                phone TEXT,
                age INTEGER,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        console.log(`✅ Tabela 'public.users' verificada/criada.`);

    } catch (error) {
        console.error('❌ Erro na migração:', error);
    } finally {
        // Encerramento forçado pois o pool pode manter aberto
        process.exit(0);
    }
}

migrate();
