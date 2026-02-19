'use server';

import { query } from './db';

// ─── Ensure table exists ────────────────────────────────
async function ensureTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS study_time_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL,
            activity_type TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL,
            metadata JSONB DEFAULT '{}',
            logged_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}

let tableChecked = false;

// ─── Log study time ─────────────────────────────────────
export async function logStudyTime(
    userId: string,
    activityType: 'quiz' | 'chat' | 'review' | 'study' | 'revisao',
    durationSeconds: number,
    metadata?: Record<string, any>
) {
    try {
        if (!tableChecked) {
            await ensureTable();
            tableChecked = true;
        }

        if (durationSeconds < 10) return; // Ignore sessions < 10 seconds

        await query(
            `INSERT INTO study_time_logs (user_id, activity_type, duration_seconds, metadata)
             VALUES ($1, $2, $3, $4)`,
            [userId, activityType, Math.round(durationSeconds), JSON.stringify(metadata || {})]
        );

        console.log(`⏱️ [StudyTime] Logged ${Math.round(durationSeconds)}s of ${activityType} for ${userId}`);
    } catch (error) {
        console.error('❌ [StudyTime] Error logging:', error);
    }
}

// ─── Get study time summary ─────────────────────────────
export async function getStudyTimeSummary(userId: string) {
    try {
        if (!tableChecked) {
            await ensureTable();
            tableChecked = true;
        }

        // Today
        const todayStr = new Date().toLocaleDateString('en-CA');
        const { rows: todayRows } = await query(
            `SELECT 
                COALESCE(SUM(duration_seconds), 0) as total_seconds,
                COUNT(*) as session_count
             FROM study_time_logs 
             WHERE user_id = $1 AND logged_at::date = $2`,
            [userId, todayStr]
        );

        // This week (Monday-Sunday)
        const { rows: weekRows } = await query(
            `SELECT 
                COALESCE(SUM(duration_seconds), 0) as total_seconds,
                COUNT(*) as session_count
             FROM study_time_logs 
             WHERE user_id = $1 
             AND logged_at >= date_trunc('week', CURRENT_DATE)`,
            [userId]
        );

        // By activity type (this week)
        const { rows: byTypeRows } = await query(
            `SELECT 
                activity_type,
                COALESCE(SUM(duration_seconds), 0) as total_seconds,
                COUNT(*) as session_count
             FROM study_time_logs 
             WHERE user_id = $1 
             AND logged_at >= date_trunc('week', CURRENT_DATE)
             GROUP BY activity_type`,
            [userId]
        );

        // Also count quiz time from attempts table (for historical data before tracking)
        const { rows: quizTimeRows } = await query(
            `SELECT COALESCE(SUM(timer_seconds), 0) as total_seconds
             FROM attempts 
             WHERE user_id = $1 AND status = 'COMPLETED' 
             AND completed_at >= date_trunc('week', CURRENT_DATE)`,
            [userId]
        );

        const todaySeconds = Number(todayRows[0]?.total_seconds || 0);
        const weekSeconds = Number(weekRows[0]?.total_seconds || 0);
        const quizHistorical = Number(quizTimeRows[0]?.total_seconds || 0);

        // Add historical quiz time if not already tracked
        const weekTotal = weekSeconds + quizHistorical;

        const byType: Record<string, { seconds: number; sessions: number }> = {};
        byTypeRows.forEach((row: any) => {
            byType[row.activity_type] = {
                seconds: Number(row.total_seconds),
                sessions: Number(row.session_count),
            };
        });

        return {
            today: {
                seconds: todaySeconds,
                formatted: formatDuration(todaySeconds),
                sessions: Number(todayRows[0]?.session_count || 0),
            },
            week: {
                seconds: weekTotal,
                formatted: formatDuration(weekTotal),
                sessions: Number(weekRows[0]?.session_count || 0),
            },
            byType,
        };
    } catch (error) {
        console.error('❌ [StudyTime] Error getting summary:', error);
        return {
            today: { seconds: 0, formatted: '0min', sessions: 0 },
            week: { seconds: 0, formatted: '0min', sessions: 0 },
            byType: {},
        };
    }
}

function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h${minutes > 0 ? `${minutes}min` : ''}`;
    return `${minutes}min`;
}
