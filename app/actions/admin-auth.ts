'use server';

import { cookies } from 'next/headers';

// SECRET KEY DEFINIDA DE FORMA HARDCODED COMO SOLICITADO
// Idealmente isso iria para .env, mas para resolver AGORA, vamos fixar aqui.
const ADMIN_SECRET_KEY = process.env.ADMIN_ACCESS_KEY || 'PROVA-RESIDENCIA-ADMIN-2026';
const COOKIE_NAME = 'admin_access_token';

export async function loginAdminAction(key: string) {
    if (key === ADMIN_SECRET_KEY) {
        // Set cookie valid for 7 days
        cookies().set(COOKIE_NAME, 'valid', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 7, // 1 week
            path: '/',
        });
        return { success: true };
    }

    return { success: false, error: 'Chave de acesso incorreta' };
}

export async function logoutAdminAction() {
    cookies().delete(COOKIE_NAME);
    return { success: true };
}

export async function checkAdminAccess() {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME);
    return token?.value === 'valid';
}
