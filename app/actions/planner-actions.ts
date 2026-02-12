'use server';

import { generateWeeklySchedule } from '@/lib/planner-service';

export async function generateScheduleAction(userId: string) {
    console.log('🚀 [Server Action] generateScheduleAction triggered for:', userId);
    try {
        const result = await generateWeeklySchedule(userId);
        console.log('✅ [Server Action] Result:', result);
        return result;
    } catch (error: any) {
        console.error('❌ [Server Action] Error:', error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}
