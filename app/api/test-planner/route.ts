
import { NextResponse } from 'next/server';
import { generateWeeklySchedule } from '@/lib/planner-service';
import { db } from '@/lib/db';

export async function GET() {
    try {
        console.log('🔍 [API] Finding a user for planner test...');
        const { rows } = await db.query('SELECT user_id, email, name FROM users LIMIT 1');

        if (rows.length === 0) {
            return NextResponse.json({ error: 'No users found' }, { status: 404 });
        }

        const user = rows[0];
        console.log(`👤 [API] Testing for user: ${user.name} (${user.user_id})`);

        const result = await generateWeeklySchedule(user.user_id);

        // Fetch generated events
        const events = await db.query('SELECT * FROM study_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5', [user.user_id]);

        return NextResponse.json({
            user,
            generationResult: result,
            recentEvents: events.rows
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
