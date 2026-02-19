import { NextRequest, NextResponse } from 'next/server';
import { logStudyTime } from '@/lib/study-time-service';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, activityType, durationSeconds } = body;

        if (!userId || !activityType || !durationSeconds) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        await logStudyTime(userId, activityType, durationSeconds);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Log study time error:', error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
