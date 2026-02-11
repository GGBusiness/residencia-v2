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

    try {
        const result = await storageService.getUploadUrl(fileName, contentType);
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Storage Error:', error);
        return { success: false, error: error.message };
    }
}
