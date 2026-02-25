'use server';

/**
 * Single server action that runs the ENTIRE exam creation flow server-side.
 * This avoids multiple client→server boundaries where Next.js can mask errors.
 * Everything happens in one request: selectDocuments + createAttempt.
 */
import { query } from '@/lib/db';

interface ExamRequest {
    area?: string;
    years?: number[];
    questionCount: number;
    programs?: string[];
    objective?: string;
    feedbackMode: 'PROVA' | 'ESTUDO';
    timer?: number;
    subareas?: string[];
    difficulty?: string;
    userId: string;
    userEmail: string;
    userName: string;
}

interface ExamResult {
    success: boolean;
    attemptId?: string;
    documentCount?: number;
    error?: string;
    errorStep?: string;
}

export async function createFullExamAction(req: ExamRequest): Promise<ExamResult> {
    // STEP 1: Select documents
    let documentIds: string[] = [];
    try {
        console.log('[createFullExam] Step 1: Selecting documents...');

        let sql = `SELECT id, title FROM documents 
            WHERE type = 'PROVA'
            AND EXISTS (SELECT 1 FROM questions q WHERE q.document_id = documents.id)`;
        const params: any[] = [];
        let pIndex = 1;

        if (req.area && req.area !== 'todas') {
            const areaMap: Record<string, string> = {
                'clinica': 'Clínica Médica',
                'cirurgia': 'Cirurgia',
                'go': 'GO',
                'pediatria': 'Pediatria',
                'preventiva': 'Preventiva',
            };
            sql += ` AND area = $${pIndex}`;
            params.push(areaMap[req.area] || req.area);
            pIndex++;
        }

        if (req.years && req.years.length > 0) {
            sql += ` AND year = ANY($${pIndex}::int[])`;
            params.push(req.years);
            pIndex++;
        }

        if (req.programs && req.programs.length > 0) {
            sql += ` AND institution = ANY($${pIndex}::text[])`;
            params.push(req.programs);
            pIndex++;
        }

        sql += ` ORDER BY year DESC LIMIT $${pIndex}`;
        const numDocs = req.questionCount <= 30 ? 6 : req.questionCount <= 50 ? 9 : 15;
        params.push(numDocs);

        const { rows } = await query(sql, params);

        if (!rows || rows.length === 0) {
            return { success: false, error: 'Nenhuma prova encontrada com esses critérios.', errorStep: 'select' };
        }

        // Smart selection: take the top N based on question count
        const selectCount = req.questionCount <= 30 ? 2 : req.questionCount <= 50 ? 3 : 5;
        documentIds = rows.slice(0, selectCount).map((r: any) => r.id);

        console.log(`[createFullExam] Found ${rows.length} docs, selected ${documentIds.length}`);
    } catch (e: any) {
        console.error('[createFullExam] Step 1 FAILED:', e.message);
        return { success: false, error: `Erro buscando provas: ${e.message}`, errorStep: 'select' };
    }

    // STEP 2: Ensure user exists in profiles (FK target)
    try {
        console.log('[createFullExam] Step 2: Ensuring profile exists...');
        await query(`
            INSERT INTO profiles (id, email, name)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO NOTHING
        `, [req.userId, req.userEmail, req.userName]);
    } catch (e: any) {
        console.error('[createFullExam] Step 2 warning:', e.message);
        // Non-fatal: profile might already exist with different columns
    }

    // STEP 3: Create attempt
    try {
        console.log('[createFullExam] Step 3: Creating attempt...');
        const config = {
            mode: 'CUSTOM',
            feedbackMode: req.feedbackMode,
            documentIds,
            questionCount: req.questionCount,
            timer: req.timer,
            objective: req.objective,
            area: req.area,
            subareas: req.subareas,
            programs: req.programs,
            years: req.years,
            difficulty: req.difficulty,
        };

        const { rows } = await query(`
            INSERT INTO attempts (user_id, config, status, total_questions, timer_seconds, started_at)
            VALUES ($1, $2, 'IN_PROGRESS', $3, $4, NOW())
            RETURNING id
        `, [req.userId, JSON.stringify(config), req.questionCount, req.timer || null]);

        const attemptId = rows[0].id;
        console.log(`[createFullExam] SUCCESS! attemptId=${attemptId}`);

        return {
            success: true,
            attemptId,
            documentCount: documentIds.length,
        };
    } catch (e: any) {
        console.error('[createFullExam] Step 3 FAILED:', e.message, e.code, e.detail);
        return { success: false, error: `Erro criando prova: ${e.message}`, errorStep: 'create' };
    }
}
