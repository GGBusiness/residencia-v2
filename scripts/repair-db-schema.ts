
import { db } from '../lib/db';

async function repairSchema() {
    try {
        console.log('🛠️ [REPAIR] Starting Schema Repair for Study Planner...');

        const sql = `
            -- 1. Add event_type to study_events if it doesn't exist
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='study_events' AND column_name='event_type') THEN
                    ALTER TABLE study_events ADD COLUMN event_type TEXT;
                    RAISE NOTICE 'Added event_type to study_events';
                END IF;
            END $$;

            -- 2. Add best_study_time to user_profiles if it doesn't exist
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='best_study_time') THEN
                    ALTER TABLE user_profiles ADD COLUMN best_study_time TEXT;
                    RAISE NOTICE 'Added best_study_time to user_profiles';
                END IF;
            END $$;

            -- 3. Ensure users table has onboarding_completed
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='onboarding_completed') THEN
                    ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
                    RAISE NOTICE 'Added onboarding_completed to users';
                END IF;
            END $$;
        `;

        await db.query(sql);

        console.log('✅ [REPAIR] Schema Repair Successful!');
        process.exit(0);

    } catch (error: any) {
        console.error('❌ [REPAIR] Failed to repair schema:', error.message);
        process.exit(1);
    }
}

repairSchema();
