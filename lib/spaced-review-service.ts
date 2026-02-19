'use server';

import { query } from './db';

/**
 * Revisão Espaçada — Agenda revisões automáticas em 3, 10 e 30 dias
 * após completar uma sessão de estudo ou quiz.
 * 
 * Intervals baseados na curva de esquecimento de Ebbinghaus:
 * - 3 dias: Reforço inicial
 * - 10 dias: Consolidação
 * - 30 dias: Fixação de longo prazo
 */

const REVIEW_INTERVALS = [3, 10, 30];

interface ScheduleReviewParams {
    userId: string;
    area: string;
    completedDate: string; // YYYY-MM-DD
    sourceType: 'study' | 'quiz';
    sourceTitle?: string;
}

export async function scheduleSpacedReviews(params: ScheduleReviewParams) {
    try {
        const { userId, area, completedDate, sourceType, sourceTitle } = params;
        const safeArea = area.replace(/'/g, "''");
        const baseDate = new Date(completedDate + 'T12:00:00');

        const values: string[] = [];

        for (const interval of REVIEW_INTERVALS) {
            const reviewDate = new Date(baseDate);
            reviewDate.setDate(baseDate.getDate() + interval);
            const dateStr = reviewDate.toLocaleDateString('en-CA');

            // Skip if Sunday
            if (reviewDate.getDay() === 0) {
                reviewDate.setDate(reviewDate.getDate() + 1);
            }

            const reviewDateStr = reviewDate.toLocaleDateString('en-CA');

            // Check if a review already exists for this area on this date
            const { rows: existing } = await query(
                `SELECT id FROM study_events 
                 WHERE user_id = $1 AND area = $2 AND date = $3 AND event_type = 'review'
                 AND title LIKE '%Revisão Espaçada%'`,
                [userId, area, reviewDateStr]
            );

            if (existing.length > 0) continue; // Skip duplicates

            const labelMap: Record<number, string> = {
                3: 'Reforço (D+3)',
                10: 'Consolidação (D+10)',
                30: 'Fixação (D+30)',
            };
            const label = labelMap[interval] || `D+${interval}`;
            const title = `Revisão Espaçada: ${safeArea} — ${label}`;

            values.push(
                `('${userId}', '${title}', 'review', '${safeArea}', '${reviewDateStr}', '08:00', '09:30', FALSE)`
            );
        }

        if (values.length === 0) {
            console.log(`📋 [SpacedReview] No new reviews needed for ${area}`);
            return { success: true, count: 0 };
        }

        await query(
            `INSERT INTO study_events (user_id, title, event_type, area, date, start_time, end_time, completed)
             VALUES ${values.join(', ')}`
        );

        console.log(`🔁 [SpacedReview] Scheduled ${values.length} reviews for ${area} (from ${sourceType})`);
        return { success: true, count: values.length };

    } catch (error: any) {
        console.error('❌ [SpacedReview] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get pending reviews for a user (today and overdue)
 */
export async function getPendingReviews(userId: string) {
    try {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const { rows } = await query(
            `SELECT * FROM study_events 
             WHERE user_id = $1 
             AND event_type = 'review' 
             AND title LIKE '%Revisão Espaçada%'
             AND completed = FALSE 
             AND date <= $2
             ORDER BY date ASC`,
            [userId, todayStr]
        );
        return rows;
    } catch (error) {
        console.error('Error getting pending reviews:', error);
        return [];
    }
}
