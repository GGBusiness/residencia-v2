'use server';

import { createServerClient } from '@/lib/supabase';
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
    const supabase = createServerClient();

    try {
        // 1. Basic Counts
        const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

        // 2. New Users Today
        const today = new Date().toISOString().split('T')[0];
        const { count: newUsersToday } = await supabase.from('users')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today);

        // 3. Activity Today (Attempts)
        const { count: attemptsToday } = await supabase.from('attempts')
            .select('*', { count: 'exact', head: true })
            .gte('started_at', today);

        // 4. Content Stats
        const { count: totalQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true });

        // 5. Advanced Analytics (Raw SQL for Performance & Complexity)

        // 5.1 Institutions Popularity (Top 5)
        const { rows: topInstitutions } = await query(`
            SELECT config->>'institution' as name, COUNT(*) as usage_count
            FROM attempts 
            WHERE config->>'institution' IS NOT NULL
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 5
        `).catch(() => ({ rows: [] }));

        // 5.2 Areas Popularity (Where users struggle/practice most)
        // This requires joining questions or parsing config.
        const { rows: topAreas } = await query(`
             SELECT area, COUNT(*) as count
             FROM questions q
             JOIN attempt_answers aa ON aa.choice IS NOT NULL -- Just a proxy join logic
             WHERE q.id = aa.question_id -- This might fail if no FK
             GROUP BY 1
             ORDER BY 2 DESC 
             LIMIT 5
        `).catch(() => ({ rows: [] }));
        // Fallback if join fails or is too heavy: use attempt config
        if (!topAreas || topAreas.length === 0) {
            // ... alternate query or empty
        }

        // 5.3 User Demographics (Calculated from user_profiles if available, or metadata)
        // Placeholder for now as we don't have strict DOB in basic auth
        // We will return a mock distribution or data if 'user_goals' has specialty
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
                users: { total: userCount, newUsersToday: newUsersToday },
                activity: { attemptsToday },
                content: { totalQuestions },
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
    const supabase = createServerClient();

    try {
        // Check if table exists first involves a query, but we can just try selecting
        const { data, error } = await supabase
            .from('api_usage_logs')
            .select('cost_usd, tokens_input, tokens_output, provider, created_at')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) {
            // If table doesn't exist, Supabase returns error 42P01 (undefined_table)
            if (error.code === '42P01') {
                return { success: false, error: 'Tabela de logs não encontrada. Execute o setup.' };
            }
            throw error;
        }

        const totalCost = data.reduce((acc, curr) => acc + (Number(curr.cost_usd) || 0), 0);

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
