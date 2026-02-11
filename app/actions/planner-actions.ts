'use server';

import { generateWeeklySchedule } from '@/lib/planner-service';

export async function generateScheduleAction(userId: string) {
    try {
        const result = await generateWeeklySchedule(userId);
        return result;
    } catch (error: any) {
        console.error('Error in generateScheduleAction:', error);
        return { success: false, error: error.message };
    }
}
