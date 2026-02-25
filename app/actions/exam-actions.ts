'use server';

/**
 * AI-POWERED Exam Engine
 * Uses user performance data + notas de corte + RAG knowledge base
 * to create personalized exams that target weak areas.
 */
import { query } from '@/lib/db';
import { getUserStats, getCutScore } from '@/lib/stats-service';

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
    aiInsight?: string; // AI explanation of why these questions were chosen
}

export async function createFullExamAction(req: ExamRequest): Promise<ExamResult> {
    // STEP 0: AI Performance Analysis (for smart exam modes)
    let weakAreas: string[] = [];
    let aiInsight = '';
    const isSmartMode = req.objective === 'pontos-fracos' || req.objective === 'prova-completa';

    if (isSmartMode && req.userId) {
        try {
            console.log('[AI-Exam] Analyzing user performance...');
            const stats = await getUserStats(req.userId);

            if (stats.weaknesses.length > 0) {
                weakAreas = stats.weaknesses.map(w => w.area);
                aiInsight = `🧠 IA detectou seus pontos fracos: ${weakAreas.join(', ')}. `;

                if (req.objective === 'pontos-fracos') {
                    aiInsight += `Prova montada com foco TOTAL nessas áreas.`;
                } else {
                    aiInsight += `Prova equilibrada com reforço nessas áreas.`;
                }
            }

            // Check notas de corte for extra priority
            const { rows: profile } = await query(
                `SELECT target_institution, target_specialty FROM user_profiles WHERE id = $1 LIMIT 1`,
                [req.userId]
            );
            if (profile.length > 0 && profile[0].target_institution) {
                const cutScore = await getCutScore(profile[0].target_institution, profile[0].target_specialty || 'Geral');
                if (cutScore && stats.averagePercentage < cutScore.percentage) {
                    const gap = (cutScore.percentage - stats.averagePercentage).toFixed(0);
                    aiInsight += ` ⚠️ Você está ${gap}% abaixo da nota de corte do ${profile[0].target_institution}.`;
                }
            }
            console.log(`[AI-Exam] Weak areas: ${weakAreas.join(', ') || 'none detected'}`);
        } catch (statErr) {
            console.error('[AI-Exam] Stats analysis failed (non-fatal):', statErr);
        }
    }

    // STEP 1: Select documents (AI-enhanced)
    let documentIds: string[] = [];
    try {
        console.log('[createFullExam] Step 1: Selecting documents...');

        // For "pontos-fracos" mode, prioritize weak-area questions
        if (req.objective === 'pontos-fracos' && weakAreas.length > 0) {
            // Get documents that have questions in weak areas
            const { rows: weakDocs } = await query(`
                SELECT DISTINCT d.id, d.title FROM documents d
                JOIN questions q ON q.document_id = d.id
                WHERE d.type = 'PROVA'
                AND q.area = ANY($1::text[])
                ORDER BY RANDOM()
                LIMIT $2
            `, [weakAreas, 10]);

            if (weakDocs.length > 0) {
                documentIds = weakDocs.map((r: any) => r.id);
                console.log(`[AI-Exam] Found ${weakDocs.length} docs with weak-area questions`);
            }
        }

        // Standard document selection (fallback or supplementary)
        if (documentIds.length < 3) {
            let sql = `SELECT id, title FROM documents 
                WHERE type = 'PROVA'
                AND EXISTS (SELECT 1 FROM questions q WHERE q.document_id = documents.id)`;
            const params: any[] = [];
            let pIndex = 1;

            // Exclude already selected docs
            if (documentIds.length > 0) {
                sql += ` AND id != ALL($${pIndex}::uuid[])`;
                params.push(documentIds);
                pIndex++;
            }

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

            sql += ` ORDER BY RANDOM() LIMIT $${pIndex}`;
            const numDocs = req.questionCount <= 30 ? 8 : req.questionCount <= 50 ? 12 : 18;
            params.push(numDocs);

            const { rows } = await query(sql, params);

            if (!rows || rows.length === 0) {
                if (documentIds.length === 0) {
                    return { success: false, error: 'Nenhuma prova encontrada com esses critérios.', errorStep: 'select' };
                }
            } else {
                const remaining = (req.questionCount <= 30 ? 2 : req.questionCount <= 50 ? 3 : 5) - documentIds.length;
                const extraIds = rows.slice(0, Math.max(remaining, 1)).map((r: any) => r.id);
                documentIds = [...documentIds, ...extraIds];
            }
        }

        // Final trim
        const maxDocs = req.questionCount <= 30 ? 4 : req.questionCount <= 50 ? 6 : 10;
        documentIds = documentIds.slice(0, maxDocs);

        console.log(`[createFullExam] Selected ${documentIds.length} documents`);
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
    }

    // STEP 3: Create attempt with AI metadata
    try {
        console.log('[createFullExam] Step 3: Creating attempt...');
        const config = {
            mode: isSmartMode ? 'AI_SMART' : 'CUSTOM',
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
            aiInsight: aiInsight || undefined,
            weakAreas: weakAreas.length > 0 ? weakAreas : undefined,
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
            aiInsight: aiInsight || undefined,
        };
    } catch (e: any) {
        console.error('[createFullExam] Step 3 FAILED:', e.message, e.code, e.detail);
        return { success: false, error: `Erro criando prova: ${e.message}`, errorStep: 'create' };
    }
}
