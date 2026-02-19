
import { db } from '../lib/db';

async function disableRLS() {
    try {
        console.log('🚀 [REPAIR] Disabling RLS on study tables to restore performance...');

        const sql = `
            ALTER TABLE study_events DISABLE ROW LEVEL SECURITY;
            ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
            ALTER TABLE user_goals DISABLE ROW LEVEL SECURITY;
            ALTER TABLE users DISABLE ROW LEVEL SECURITY;
            
            -- Also drop the problematic policies to be clean
            DROP POLICY IF EXISTS "Users can view own events" ON study_events;
            DROP POLICY IF EXISTS "Users can insert own events" ON study_events;
            DROP POLICY IF EXISTS "Users can update own events" ON study_events;
            DROP POLICY IF EXISTS "Users can delete own events" ON study_events;
            
            DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
            DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
            DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
            
            DROP POLICY IF EXISTS "Users can view own goals" ON user_goals;
            DROP POLICY IF EXISTS "Users can insert own goals" ON user_goals;
            DROP POLICY IF EXISTS "Users can update own goals" ON user_goals;
        `;

        await db.query(sql);

        console.log('✅ [REPAIR] RLS Disabled. The app should now be FAST and data should persist correctly.');
        process.exit(0);

    } catch (error) {
        console.error('❌ [REPAIR] Failed to disable RLS:', error);
        process.exit(1);
    }
}

disableRLS();
