import { generateWeeklySchedule } from '../lib/planner-service';
import { db } from '../lib/db';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testPlanner() {
    try {
        // I need a valid user ID. I'll search for one.
        console.log('🔍 Finding a user...');
        const userResult = await db.query('SELECT user_id, email, first_name FROM user_profiles LIMIT 1');

        if (userResult.rows.length === 0) {
            console.log('❌ No users found in DB.');
            return;
        }

        const user = userResult.rows[0];
        console.log(`👤 Found user: ${user.first_name} (${user.user_id})`);

        console.log('🚀 Triggering generateWeeklySchedule...');
        const result = await generateWeeklySchedule(user.user_id);
        console.log('✅ Result:', result);

        if (result.success) {
            console.log('📅 Checking events in DB...');
            const events = await db.query('SELECT title, date, start_time FROM study_events WHERE user_id = $1 ORDER BY date ASC LIMIT 5', [user.user_id]);
            console.table(events.rows);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testPlanner();
