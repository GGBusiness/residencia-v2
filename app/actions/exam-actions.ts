'use server';

import { createAttempt, type AttemptConfig, type Attempt } from '@/lib/data-service';
import { userService } from '@/lib/user-service';

/**
 * Wrapper that returns {success, data, error} instead of throwing.
 * Next.js hides thrown errors in production ("Server Components render..." message).
 * By returning the error as data, the client can display the real message.
 */
export async function createExamAction(
    config: AttemptConfig,
    user: { id: string; email: string; name: string }
): Promise<{ success: boolean; data?: Attempt; error?: string }> {
    try {
        console.log('🚀 [createExamAction] Criando prova para:', user.id);
        console.log('📋 [createExamAction] Config:', JSON.stringify(config).substring(0, 200));

        const attempt = await createAttempt(config, user.id);

        // Ensure serializable (Date objects from PG break server action responses)
        const safeAttempt = JSON.parse(JSON.stringify(attempt)) as Attempt;
        return { success: true, data: safeAttempt };
    } catch (error: any) {
        console.error('❌ [createExamAction] Erro inicial:', error.message, error.code, error.stack);

        // Se for erro de Foreign Key (usuário não existe na tabela users)
        if (error.message?.includes('foreign key constraint') || error.code === '23503') {
            console.warn('⚠️ [createExamAction] Usuário não encontrado. Sincronizando...');
            try {
                await userService.syncUser(user.id, user.email, user.name);
                const retryAttempt = await createAttempt(config, user.id);
                const safeRetry = JSON.parse(JSON.stringify(retryAttempt)) as Attempt;
                return { success: true, data: safeRetry };
            } catch (syncError: any) {
                console.error('❌ [createExamAction] Falha sincronização:', syncError.message);
                return { success: false, error: `Sync falhou: ${syncError.message}` };
            }
        }

        // Return the REAL error message to the client (not throw)
        return { success: false, error: error.message || 'Erro desconhecido ao criar prova' };
    }
}
