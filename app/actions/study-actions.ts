'use server';

import { db, query } from '@/lib/db';
import { getUserStats as getUserStatsService } from '@/lib/stats-service';
import { plannerService } from '@/lib/planner-service';

export async function getDashboardDataAction(userId: string) {
    try {
        // 1. Stats
        const stats = await getUserStatsService(userId);

        // 2. Daily Plan
        const dailyPlan = await plannerService.getDailyPlan(userId);

        // 3. Weekly Events
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const { rows: events } = await query(`
            SELECT * FROM study_events 
            WHERE user_id = $1 
            AND date >= $2 
            AND date <= $3 
            ORDER BY date, start_time
        `, [userId, monday.toISOString().split('T')[0], sunday.toISOString().split('T')[0]]);


        return {
            success: true,
            data: {
                stats: stats || {},
                dailyPlan: dailyPlan || [],
                weekEvents: events || []
            }
        };
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return { success: false, error: 'Failed to fetch dashboard data' };
    }
}

export async function getReviewStatsAction(userId: string) {
    try {
        const now = new Date().toISOString();

        // Count due reviews
        const { rows: dueRows } = await query(
            'SELECT COUNT(*) FROM user_question_progress WHERE user_id = $1 AND next_review_at <= $2',
            [userId, now]
        );
        const count = parseInt(dueRows[0].count);

        // Get next review date
        const { rows: nextRows } = await query(
            'SELECT next_review_at FROM user_question_progress WHERE user_id = $1 AND next_review_at > $2 ORDER BY next_review_at ASC LIMIT 1',
            [userId, now]
        );
        const nextReviewDate = nextRows[0]?.next_review_at || null;

        return {
            success: true,
            data: {
                totalDue: count,
                nextReviewDate
            }
        };
    } catch (error) {
        console.error('Error fetching review stats:', error);
        return { success: false, error: 'Failed' };
    }
}

export async function startReviewSessionAction(userId: string) {
    try {
        const now = new Date().toISOString();

        // 1. Get IDs of questions to review
        const { rows: dueItems } = await query(
            'SELECT question_id FROM user_question_progress WHERE user_id = $1 AND next_review_at <= $2 LIMIT 50',
            [userId, now]
        );

        if (dueItems.length === 0) {
            return { success: false, error: 'Nenhuma revisão pendente.' };
        }

        const questionIds = dueItems.map(item => item.question_id);

        // 2. Create a "Review Attempt"
        const { rows: attempts } = await query(`
            INSERT INTO attempts (user_id, attempt_type, config, status, started_at)
            VALUES ($1, 'REVIEW', $2, 'STARTED', NOW())
            RETURNING id
        `, [
            userId,
            JSON.stringify({
                type: 'review',
                specific_ids: questionIds,
                questionCount: questionIds.length
            })
        ]);

        return { success: true, attemptId: attempts[0].id };

    } catch (error) {
        console.error('Error starting review:', error);
        return { success: false, error: 'Failed' };
    }
}
