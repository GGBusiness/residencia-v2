'use server';

import { query } from '@/lib/db';

export async function setupAdminSchemaAction() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS api_usage_logs (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                provider VARCHAR(50) NOT NULL,
                model VARCHAR(100) NOT NULL,
                tokens_input INTEGER DEFAULT 0,
                tokens_output INTEGER DEFAULT 0,
                cost_usd DECIMAL(10, 6) DEFAULT 0,
                context VARCHAR(255), 
                user_id UUID,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        await query(`
            CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_logs(created_at);
        `);

        return { success: true, message: 'Tabela de logs criada com sucesso.' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getAdminStatsAction() {
    try {
        // 1. Basic Counts — ALL from DigitalOcean (profiles table, not users which is in Supabase Auth)
        const { rows: [{ count: userCount }] } = await query(
            "SELECT COUNT(*) as count FROM profiles"
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 2. New Users Today
        const today = new Date().toISOString().split('T')[0];
        const { rows: [{ count: newUsersToday }] } = await query(
            "SELECT COUNT(*) as count FROM profiles WHERE created_at >= $1",
            [today]
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 3. Activity Today (Attempts)
        const { rows: [{ count: attemptsToday }] } = await query(
            "SELECT COUNT(*) as count FROM attempts WHERE started_at >= $1",
            [today]
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 4. Content Stats
        const { rows: [{ count: totalQuestions }] } = await query(
            "SELECT COUNT(*) as count FROM questions"
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 5. Documents Stats
        const { rows: [{ count: totalDocuments }] } = await query(
            "SELECT COUNT(*) as count FROM documents"
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 6. Embeddings Stats
        const { rows: [{ count: totalEmbeddings }] } = await query(
            "SELECT COUNT(*) as count FROM document_embeddings"
        ).catch(() => ({ rows: [{ count: 0 }] }));

        // 7. Top Institutions
        const { rows: topInstitutions } = await query(`
            SELECT institution as name, COUNT(*) as usage_count
            FROM documents 
            WHERE institution IS NOT NULL
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 5
        `).catch(() => ({ rows: [] }));

        // 8. Top Areas
        const { rows: topAreas } = await query(`
            SELECT area, COUNT(*) as count
            FROM questions
            WHERE area IS NOT NULL
            GROUP BY 1
            ORDER BY 2 DESC 
            LIMIT 5
        `).catch(() => ({ rows: [] }));

        // 9. Top Specialties from user goals
        const { rows: topSpecialties } = await query(`
             SELECT specialty, COUNT(*) as count
             FROM user_goals
             GROUP BY 1
             ORDER BY 2 DESC
             LIMIT 5
        `).catch(() => ({ rows: [] }));

        return {
            success: true,
            data: {
                users: { total: parseInt(userCount), newUsersToday: parseInt(newUsersToday) },
                activity: { attemptsToday: parseInt(attemptsToday) },
                content: {
                    totalQuestions: parseInt(totalQuestions),
                    totalDocuments: parseInt(totalDocuments),
                    totalEmbeddings: parseInt(totalEmbeddings)
                },
                analytics: {
                    topInstitutions,
                    topAreas,
                    topSpecialties
                }
            }
        };

    } catch (error: any) {
        console.error('Admin Stats Error:', error);
        return { success: false, error: error.message };
    }
}

export async function getAdminCostsAction() {
    try {
        const { rows: data } = await query(`
            SELECT cost_usd, tokens_input, tokens_output, provider, created_at
            FROM api_usage_logs
            ORDER BY created_at DESC
            LIMIT 100
        `).catch(() => ({ rows: [] }));

        const totalCost = data.reduce((acc: number, curr: any) => acc + (Number(curr.cost_usd) || 0), 0);

        return {
            success: true,
            data: {
                history: data,
                totalCost
            }
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
