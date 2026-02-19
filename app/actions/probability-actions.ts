'use server';

import { calculateProbabilityScore } from '@/lib/probability-score-service';

export async function getProbabilityScoreAction(userId: string) {
    try {
        const result = await calculateProbabilityScore(userId);
        return { success: true, data: result };
    } catch (error: any) {
        console.error('Error getting probability score:', error);
        return { success: false, error: error.message };
    }
}
