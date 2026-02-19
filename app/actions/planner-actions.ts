'use server';

import { generateWeeklySchedule } from '@/lib/planner-service';
import { revalidatePath } from 'next/cache';

export async function generateScheduleAction(userId: string, clientDate?: string) {
    console.log('🚀 [Server Action] generateScheduleAction triggered for:', userId, 'Client Date:', clientDate);
    try {
        const result = await generateWeeklySchedule(userId, clientDate);
        console.log('✅ [Server Action] Result:', result);
        revalidatePath('/app');
        revalidatePath('/app/planner');
        return result;
    } catch (error: any) {
        console.error('❌ [Server Action] Error:', error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}
