'use server';

import { storageService } from '@/lib/storage';
import { cookies } from 'next/headers';

/**
 * Gera URL de upload para o Storage (DigitalOcean Spaces).
 * Protegido: Exige cookie 'admin_access_token'.
 */
export async function getPresignedUrlAction(fileName: string, contentType: string) {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_access_token');

    if (!token || token.value !== 'valid') {
        return { success: false, error: 'Unauthorized' };
    }

    // Validação de Debug para o Usuário
    if (!process.env.SPACES_KEY || !process.env.SPACES_SECRET) {
        console.error("❌ ERRO CRÍTICO: Variáveis SPACES_KEY/SECRET não encontradas no ambiente do servidor.");
        return {
            success: false,
            error: 'MISSING_ENV: As chaves da DigitalOcean não estão configuradas na Vercel (Environment Variables).'
        };
    }

    try {
        const result = await storageService.getUploadUrl(fileName, contentType);
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Storage Error:', error);
        return { success: false, error: error.message };
    }
}
