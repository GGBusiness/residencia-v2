
import { query } from '../lib/db';
import { generateWeeklySchedule } from '../lib/planner-service';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    const userId = '31d38645-590d-459f-8410-67baded18b9a';
    console.log('🔍 Starting Debug for User:', userId);

    try {
        // 1. Check Profile
        const { rows: profiles } = await query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
        console.log('👤 Profile Found:', JSON.stringify(profiles[0], null, 2));

        if (!profiles[0]) {
            console.error('❌ Profile missing! Logic will use fallbacks.');
        }

        // 2. Run Generation Logic
        console.log('⚙️ Running generateWeeklySchedule...');
        const result = await generateWeeklySchedule(userId);
        console.log('✅ Generation Result:', JSON.stringify(result, null, 2));

        // 3. Verify Events Created
        const { rows: events } = await query('SELECT title, date, start_time, end_time FROM study_events WHERE user_id = $1 AND date >= CURRENT_DATE ORDER BY date ASC, start_time ASC LIMIT 10', [userId]);
        console.log('📅 Newly Created Events (Top 10):');
        console.table(events);

    } catch (error) {
        console.error('💥 Debug Error:', error);
    } finally {
        process.exit();
    }
}

debug();
