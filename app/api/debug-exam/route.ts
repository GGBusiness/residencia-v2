import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const results: any = { steps: [], errors: [] };

    // Step 1: Test DB connection
    try {
        const { rows } = await query('SELECT NOW() as now');
        results.steps.push({ step: '1_db_connection', status: 'OK', time: rows[0].now });
    } catch (e: any) {
        results.errors.push({ step: '1_db_connection', error: e.message });
        return NextResponse.json(results);
    }

    // Step 2: Check attempts table schema
    try {
        const { rows } = await query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'attempts'
            ORDER BY ordinal_position
        `);
        results.steps.push({ step: '2_attempts_schema', status: 'OK', columns: rows.map(r => `${r.column_name} (${r.data_type})`) });
    } catch (e: any) {
        results.errors.push({ step: '2_attempts_schema', error: e.message });
    }

    // Step 3: Test selectDocuments logic (same as pdf-selector.ts)
    try {
        const { rows } = await query(`
            SELECT id, title, institution, year, type
            FROM documents
            WHERE type = 'PROVA'
            ORDER BY year DESC
            LIMIT 5
        `);
        results.steps.push({ step: '3_select_documents', status: 'OK', count: rows.length, docs: rows });
    } catch (e: any) {
        results.errors.push({ step: '3_select_documents', error: e.message });
    }

    // Step 4: Test INSERT into attempts (dry run with rollback)
    try {
        const testConfig = { mode: 'CUSTOM', questionCount: 10, feedbackMode: 'PROVA' };

        // Start transaction
        await query('BEGIN');

        const { rows } = await query(`
            INSERT INTO attempts (user_id, attempt_type, config, status, total_questions, started_at)
            VALUES ($1, $2, $3, 'IN_PROGRESS', $4, NOW())
            RETURNING id, user_id, attempt_type, status, total_questions, started_at
        `, ['00000000-0000-0000-0000-000000000000', 'CUSTOM', JSON.stringify(testConfig), 10]);

        // Rollback - don't actually create the attempt
        await query('ROLLBACK');

        results.steps.push({ step: '4_insert_attempt', status: 'OK', result: rows[0] });
    } catch (e: any) {
        await query('ROLLBACK').catch(() => { });
        results.errors.push({ step: '4_insert_attempt', error: e.message, code: e.code, detail: e.detail });
    }

    // Step 5: Check if user exists (simulating the foreign key check)
    try {
        const { rows } = await query('SELECT id, email, name FROM users LIMIT 3');
        results.steps.push({ step: '5_users_table', status: 'OK', count: rows.length, users: rows.map(u => ({ id: u.id, email: u.email })) });
    } catch (e: any) {
        results.errors.push({ step: '5_users_table', error: e.message });
    }

    // Step 6: Test the full flow import chain
    try {
        const dataService = await import('@/lib/data-service');
        const functions = Object.keys(dataService).filter(k => typeof (dataService as any)[k] === 'function');
        results.steps.push({ step: '6_data_service_import', status: 'OK', exports: functions });
    } catch (e: any) {
        results.errors.push({ step: '6_data_service_import', error: e.message, stack: e.stack?.substring(0, 500) });
    }

    // Step 7: Test user-service import
    try {
        const userSvc = await import('@/lib/user-service');
        results.steps.push({ step: '7_user_service_import', status: 'OK', hasUserService: !!userSvc.userService });
    } catch (e: any) {
        results.errors.push({ step: '7_user_service_import', error: e.message, stack: e.stack?.substring(0, 500) });
    }

    results.summary = results.errors.length === 0 ? 'ALL TESTS PASSED' : `${results.errors.length} ERRORS FOUND`;

    return NextResponse.json(results, { status: results.errors.length > 0 ? 500 : 200 });
}
