'use server';

import { createAttempt, type AttemptConfig, type Attempt } from '@/lib/data-service';
import { userService } from '@/lib/user-service';

export async function createExamAction(config: AttemptConfig, user: { id: string, email: string, name: string }) {
    try {
        console.log('🚀 [createExamAction] Criando prova para:', user.id);
        const attempt = await createAttempt(config, user.id);
        return attempt;
    } catch (error: any) {
        console.error('❌ [createExamAction] Erro inicial:', error.message);

        // Se for erro de Foreign Key (usuário não existe na tabela users)
        if (error.message.includes('foreign key constraint') || error.code === '23503') {
            console.warn('⚠️ [createExamAction] Usuário não encontrado no banco. Tentando sincronizar...');

            try {
                // Tentar sincronizar o usuário
                await userService.syncUser(user.id, user.email, user.name);
                console.log('✅ [createExamAction] Usuário sincronizado. Tentando criar prova novamente...');

                // Tentar novamente
                const retryAttempt = await createAttempt(config, user.id);
                return retryAttempt;
            } catch (syncError: any) {
                console.error('❌ [createExamAction] Falha crítica na sincronização:', syncError);
                throw new Error(`Falha ao sincronizar usuário: ${syncError.message}`);
            }
        }

        throw error;
    }
}
