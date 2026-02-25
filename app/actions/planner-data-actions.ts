'use server';

import { query } from '@/lib/db';

/**
 * Busca todos os study_events de um usuário.
 */
export async function getStudyEventsAction(userId: string) {
    try {
        const { rows } = await query(
            `SELECT * FROM study_events 
             WHERE user_id = $1 
             ORDER BY date ASC, start_time ASC`,
            [userId]
        );
        return { success: true, data: rows };
    } catch (error: any) {
        console.error('Error fetching study events:', error);
        return { success: true, data: [] }; // Return empty on error (table may not exist)
    }
}

/**
 * Cria um novo study_event.
 */
export async function createStudyEventAction(userId: string, eventData: {
    title: string;
    description?: string;
    event_type: string;
    area?: string;
    date: string;
    start_time: string;
    end_time: string;
}) {
    try {
        const { rows } = await query(
            `INSERT INTO study_events (user_id, title, description, event_type, area, date, start_time, end_time)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                userId,
                eventData.title,
                eventData.description || '',
                eventData.event_type,
                eventData.area || null,
                eventData.date,
                eventData.start_time,
                eventData.end_time,
            ]
        );
        return { success: true, data: rows[0] };
    } catch (error: any) {
        console.error('Error creating study event:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggle completed status de um study_event.
 */
export async function toggleEventCompleteAction(eventId: string, completed: boolean) {
    try {
        await query(
            `UPDATE study_events SET completed = $1 WHERE id = $2`,
            [completed, eventId]
        );
        return { success: true };
    } catch (error: any) {
        console.error('Error toggling event:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deleta um study_event.
 */
export async function deleteStudyEventAction(eventId: string) {
    try {
        await query(
            `DELETE FROM study_events WHERE id = $1`,
            [eventId]
        );
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting event:', error);
        return { success: false, error: error.message };
    }
}
