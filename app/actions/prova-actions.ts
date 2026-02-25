'use server';

import { query } from '@/lib/db';

/**
 * Busca um attempt e seus documentos associados.
 */
export async function getAttemptWithDocumentsAction(attemptId: string) {
    try {
        // 1. Buscar attempt
        const { rows: attempts } = await query(
            `SELECT * FROM attempts WHERE id = $1`,
            [attemptId]
        );

        if (attempts.length === 0) {
            return { success: false, error: 'Prova não encontrada.' };
        }

        const attempt = attempts[0];

        // 2. Parse config para obter documentIds
        let config = attempt.config;
        if (typeof config === 'string') {
            try { config = JSON.parse(config); } catch { config = {}; }
        }

        const documentIds = config?.documentIds || [];
        let documents: any[] = [];

        if (documentIds.length > 0) {
            // Build safe parameterized IN clause
            const placeholders = documentIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
            const { rows: docs } = await query(
                `SELECT * FROM documents WHERE id IN (${placeholders})`,
                documentIds
            );
            documents = docs;
        }

        return {
            success: true,
            data: {
                attempt: { ...attempt, config },
                documents,
            }
        };
    } catch (error: any) {
        console.error('Error fetching attempt:', error);
        return { success: false, error: error.message };
    }
}
