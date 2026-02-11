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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString();

        // 1. User Stats
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });

        const { count: newUsersToday } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStr);

        // 2. Activity Stats (Attempts)
        const { count: totalAttempts } = await supabase.from('attempts').select('*', { count: 'exact', head: true });

        const { count: attemptsToday } = await supabase
            .from('attempts')
            .select('*', { count: 'exact', head: true })
            .gte('started_at', todayStr);

        // 3. Content Stats
        const { count: totalQuestions } = await supabase.from('questions').select('*', { count: 'exact', head: true });

        // 4. Usage Heuristics (Approximate)
        // Active Users Today (Unique users who made an attempt) - This is hard without distinct count via RPC
        // We will just use attemptsToday as a proxy for "Activity Level" for now.

        return {
            success: true,
            data: {
                users: {
                    total: totalUsers || 0,
                    newToday: newUsersToday || 0
                },
                activity: {
                    totalAttempts: totalAttempts || 0,
                    attemptsToday: attemptsToday || 0
                },
                content: {
                    totalQuestions: totalQuestions || 0
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
