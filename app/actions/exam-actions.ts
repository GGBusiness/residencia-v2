'use server';

import { createAttempt, type AttemptConfig, type Attempt } from '@/lib/data-service';
import { query } from '@/lib/db';

/**
 * Wrapper that returns {success, data, error} instead of throwing.
 * Next.js hides thrown errors in production ("Server Components render..." message).
 */
export async function createExamAction(
    config: AttemptConfig,
    user: { id: string; email: string; name: string }
): Promise<{ success: boolean; data?: Attempt; error?: string }> {
    try {
        console.log('🚀 [createExamAction] Criando prova para:', user.id);

        const attempt = await createAttempt(config, user.id);

        // Ensure serializable (Date objects from PG break server action responses)
        const safeAttempt = JSON.parse(JSON.stringify(attempt)) as Attempt;
        return { success: true, data: safeAttempt };
    } catch (error: any) {
        console.error('❌ [createExamAction] Erro:', error.message, error.code);

        // FK constraint: user_id → profiles. User might not have a profile row yet.
        if (error.message?.includes('foreign key constraint') || error.code === '23503') {
            console.warn('⚠️ [createExamAction] FK falhou — tentando criar profile...');
            try {
                // Ensure user exists in profiles (FK target table)
                await query(`
                    INSERT INTO profiles (id, email, name)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (id) DO NOTHING
                `, [user.id, user.email, user.name]);

                const retryAttempt = await createAttempt(config, user.id);
                return { success: true, data: JSON.parse(JSON.stringify(retryAttempt)) };
            } catch (syncError: any) {
                console.error('❌ [createExamAction] Retry falhou:', syncError.message);
                return { success: false, error: `FK retry falhou: ${syncError.message}` };
            }
        }

        return { success: false, error: error.message || 'Erro desconhecido' };
    }
}
