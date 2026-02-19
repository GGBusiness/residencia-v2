'use server';

import { logStudyTime, getStudyTimeSummary } from '@/lib/study-time-service';

export async function logStudyTimeAction(
    userId: string,
    activityType: 'quiz' | 'chat' | 'review' | 'study' | 'revisao',
    durationSeconds: number,
    metadata?: Record<string, any>
) {
    await logStudyTime(userId, activityType, durationSeconds, metadata);
    return { success: true };
}

export async function getStudyTimeSummaryAction(userId: string) {
    try {
        const summary = await getStudyTimeSummary(userId);
        return { success: true, data: summary };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
