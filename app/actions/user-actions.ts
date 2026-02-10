'use server';

import { userService, type OnboardingData } from '@/lib/user-service';
import { getUserStats as getUserStatsService } from '@/lib/stats-service';

export async function completeOnboardingAction(userId: string, data: OnboardingData) {
    try {
        const result = await userService.completeOnboarding(userId, data);
        return { success: result };
    } catch (error) {
        console.error('Error in completeOnboardingAction:', error);
        return { success: false, error: 'Failed to complete onboarding' };
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
