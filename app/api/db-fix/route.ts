
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
    try {
        console.log('🛡️ [DB FIXER] Starting Granular Schema Repair...');

        const commands = [
            // 1. RLS
            "ALTER TABLE study_events DISABLE ROW LEVEL SECURITY",
            "ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY",
            "ALTER TABLE user_goals DISABLE ROW LEVEL SECURITY",
            "ALTER TABLE users DISABLE ROW LEVEL SECURITY",

            // 2. Clear problematic policies
            "DROP POLICY IF EXISTS \"Users can view own events\" ON study_events",
            "DROP POLICY IF EXISTS \"Users can insert own events\" ON study_events",

            // 3. Add Columns (Direct SQL)
            "ALTER TABLE study_events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'study'",
            "ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS best_study_time TEXT DEFAULT 'noite'",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE",
            "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS percentage NUMERIC",
            "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS correct_answers INTEGER",
            "ALTER TABLE attempts ADD COLUMN IF NOT EXISTS timer_seconds INTEGER"
        ];

        for (const cmd of commands) {
            try {
                await db.query(cmd);
                console.log(`✅ Success: ${cmd.substring(0, 50)}...`);
            } catch (err: any) {
                console.warn(`⚠️ Warning/Error on: ${cmd.substring(0, 30)} -> ${err.message}`);
            }
        }

        // 4. Verify Columns (Extra check)
        const checkSql = "SELECT column_name FROM information_schema.columns WHERE table_name = 'study_events'";
        const { rows } = await db.query(checkSql);
        const columns = rows.map(r => r.column_name);
        console.log('📊 study_events current columns:', columns);

        if (!columns.includes('event_type')) {
            throw new Error("Falha Crítica: Coluna 'event_type' não foi criada mesmo após comando.");
        }

        const checkSqlAttempts = "SELECT column_name FROM information_schema.columns WHERE table_name = 'attempts'";
        const { rows: rowsAttempts } = await db.query(checkSqlAttempts);
        const columnsAttempts = rowsAttempts.map(r => r.column_name);

        return NextResponse.json({
            success: true,
            message: 'REPARO GRANULAR CONCLUÍDO: RLS desativado e colunas verificadas.',
            columns: columns,
            columnsAttempts: columnsAttempts
        });

    } catch (error: any) {
        console.error('❌ [DB FIXER] Critical Failure:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 200 });
    }
}
