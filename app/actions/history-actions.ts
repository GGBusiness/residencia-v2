'use server';

import { query } from '@/lib/db';

/**
 * Get user's attempt history from the SAME database (DigitalOcean PostgreSQL)
 * where exams are created. This fixes the Supabase vs DigitalOcean mismatch.
 */
export async function getHistoryAction(userId: string) {
    try {
        const { rows } = await query(`
            SELECT id, user_id, config, status, total_questions,
                   correct_answers, percentage, timer_seconds,
                   started_at, completed_at
            FROM attempts
            WHERE user_id = $1
            ORDER BY started_at DESC
            LIMIT 50
        `, [userId]);

        // Serialize dates for client
        const data = JSON.parse(JSON.stringify(rows));

        return { success: true, data };
    } catch (error: any) {
        console.error('Error in getHistoryAction:', error.message);
        return { success: false, error: error.message, data: [] };
    }
}
