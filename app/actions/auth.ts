'use server';

import { db } from '@/lib/db';

export async function createUserProfile(userData: {
    id: string;
    email: string;
    name: string;
    phone?: string;
    age?: number;
}) {
    console.log('👤 Criando perfil no DigitalOcean:', userData.email);

    try {
        // Tenta inserir na tabela 'users' (nossa tabela principal agora)
        // Usamos ON CONFLICT para evitar erros se o webhook do Supabase já tiver criado (futuro)
        await db.query(`
            INSERT INTO users (id, email, name, phone, age, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (id) DO UPDATE 
            SET name = EXCLUDED.name,
                phone = EXCLUDED.phone,
                age = EXCLUDED.age;
        `, [userData.id, userData.email, userData.name, userData.phone || null, userData.age || null]);

        // Também sincroniza na tabela 'user_profiles' para manter compatibilidade
        await db.query(`
            INSERT INTO user_profiles (user_id, email, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id) DO NOTHING;
        `, [userData.id, userData.email]);

        return { success: true };
    } catch (error: any) {
        console.error('❌ Erro ao criar perfil:', error);
        return { success: false, error: error.message };
    }
}
