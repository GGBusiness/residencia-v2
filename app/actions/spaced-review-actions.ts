'use server';

import { scheduleSpacedReviews, getPendingReviews } from '@/lib/spaced-review-service';

export async function scheduleSpacedReviewsAction(
    userId: string,
    area: string,
    completedDate: string,
    sourceType: 'study' | 'quiz',
    sourceTitle?: string
) {
    return await scheduleSpacedReviews({ userId, area, completedDate, sourceType, sourceTitle });
}

export async function getPendingReviewsAction(userId: string) {
    try {
        const reviews = await getPendingReviews(userId);
        return { success: true, data: reviews };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
