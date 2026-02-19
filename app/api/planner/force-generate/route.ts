
import { NextResponse } from 'next/server';
import { generateWeeklySchedule } from '@/lib/planner-service';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const clientDate = searchParams.get('date') || new Date().toLocaleDateString('en-CA');

    if (!userId) {
        return NextResponse.json({ success: false, error: 'User ID missing' }, { status: 400 });
    }

    try {
        console.log(`🚀 [API Force Generate] Starting for user ${userId} and date ${clientDate}`);
        const result = await generateWeeklySchedule(userId, clientDate);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('❌ [API Force Generate] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
