'use server';

import { userService, type OnboardingData } from '@/lib/user-service';
import { getUserStats as getUserStatsService } from '@/lib/stats-service';

export async function completeOnboardingAction(userId: string, data: OnboardingData) {
    try {
        console.log(`[Action] Starting onboarding for user ${userId}`);
        const result = await userService.completeOnboarding(userId, data);
        console.log(`[Action] Onboarding result: ${result}`);
        return { success: result };
    } catch (error: any) {
        console.error('❌ Error in completeOnboardingAction:', {
            message: error.message,
            stack: error.stack,
            detail: error
        });
        return { success: false, error: `Falha no servidor: ${error.message}` };
    }
}

export async function getUserStatsAction(userId: string) {
    try {
        const stats = await getUserStatsService(userId);
        return { success: true, data: stats };
    } catch (error) {
        console.error('Error in getUserStatsAction:', error);
        return { success: false, error: 'Failed to fetch stats' };
    }
}
