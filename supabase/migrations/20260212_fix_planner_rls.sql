
-- Enable RLS on planner tables
ALTER TABLE study_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

-- Study Events Policies
DROP POLICY IF EXISTS "Users can view own events" ON study_events;
CREATE POLICY "Users can view own events" ON study_events
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own events" ON study_events;
CREATE POLICY "Users can insert own events" ON study_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own events" ON study_events;
CREATE POLICY "Users can update own events" ON study_events
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own events" ON study_events;
CREATE POLICY "Users can delete own events" ON study_events
    FOR DELETE USING (auth.uid() = user_id);

-- User Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- User Goals Policies
DROP POLICY IF EXISTS "Users can view own goals" ON user_goals;
CREATE POLICY "Users can view own goals" ON user_goals
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own goals" ON user_goals;
CREATE POLICY "Users can insert own goals" ON user_goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own goals" ON user_goals;
CREATE POLICY "Users can update own goals" ON user_goals
    FOR UPDATE USING (auth.uid() = user_id);

-- Fix Users Table RLS if needed (Critical for syncing)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Allow Service Role to manage users (for onboarding sync if needed via admin, but usually auth.uid is enough)
-- If syncUserAction runs server-side with service role, it bypasses RLS.
-- But if it runs as user, we need INSERT policy.

DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);
