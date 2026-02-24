'use server';

import { query } from '@/lib/db';

export interface QuizData {
    attempt: any;
    questions: any[];
    answers: any[];
}

/**
 * Load quiz data — questions filtered by documentIds from attempt config.
 * 
 * Actual questions columns: id, document_id, number_in_exam, stem,
 * option_a, option_b, option_c, option_d, option_e, correct_option (char),
 * explanation, area, subarea, topic, created_at
 * 
 * NOTE: NO 'difficulty' column exists. 0/474 questions have explanations.
 */
export async function getQuizDataAction(attemptId: string): Promise<{ success: boolean; data?: QuizData; error?: string }> {
    try {
        // 1. Get Attempt
        const { rows: attempts } = await query('SELECT * FROM attempts WHERE id = $1', [attemptId]);
        const attempt = attempts[0];
        if (!attempt) return { success: false, error: 'Attempt not found' };

        const config = attempt.config || {};
        console.log('[getQuizDataAction] Config:', JSON.stringify(config).substring(0, 200));

        // 2. Get Questions — use documentIds from config
        let questions: any[] = [];

        if (config.documentIds && config.documentIds.length > 0) {
            const { rows } = await query(`
                SELECT q.id, q.document_id, q.number_in_exam, q.stem,
                       q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
                       q.correct_option, q.explanation, q.area, q.subarea, q.topic,
                       d.title as doc_title, d.institution, d.year as doc_year
                FROM questions q
                JOIN documents d ON q.document_id = d.id
                WHERE q.document_id = ANY($1::uuid[])
                ORDER BY d.year DESC, q.number_in_exam ASC NULLS LAST
            `, [config.documentIds]);
            questions = rows;
            console.log(`[getQuizDataAction] Found ${questions.length} questions from ${config.documentIds.length} documents`);
        }

        // Fallback: if no questions from documentIds, try area filter
        if (questions.length === 0) {
            console.log('[getQuizDataAction] Fallback: querying by area');
            let sql = `
                SELECT q.id, q.document_id, q.number_in_exam, q.stem,
                       q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
                       q.correct_option, q.explanation, q.area, q.subarea, q.topic,
                       d.title as doc_title, d.institution, d.year as doc_year
                FROM questions q
                JOIN documents d ON q.document_id = d.id
                WHERE 1=1
            `;
            const params: any[] = [];
            let pIndex = 1;

            if (config.area && config.area !== 'todas') {
                sql += ` AND q.area = $${pIndex}`;
                params.push(config.area);
                pIndex++;
            }

            sql += ` ORDER BY d.year DESC, q.number_in_exam ASC NULLS LAST`;
            sql += ` LIMIT $${pIndex}`;
            params.push(config.questionCount || 20);

            const { rows } = await query(sql, params);
            questions = rows;
        }

        // Limit to requested count
        const limit = config.questionCount || 20;
        if (questions.length > limit) {
            questions = questions.slice(0, limit);
        }

        // 3. Map DB fields to Frontend fields
        const mappedQuestions = questions.map(q => ({
            id: q.id,
            institution: q.institution || q.doc_title || 'Prova',
            year: q.doc_year || 0,
            area: q.area || 'Geral',
            subarea: q.subarea || '',
            difficulty: 'Média', // Column doesn't exist in DB, use default
            question_text: cleanStem(q.stem),
            option_a: q.option_a || '',
            option_b: q.option_b || '',
            option_c: q.option_c || '',
            option_d: q.option_d || '',
            option_e: q.option_e || null,
            correct_answer: q.correct_option,
            explanation: q.explanation || 'Explicação não disponível para esta questão.',
        }));

        // 4. Get existing answers
        const { rows: answers } = await query('SELECT * FROM attempt_answers WHERE attempt_id = $1', [attemptId]);

        return {
            success: true,
            data: JSON.parse(JSON.stringify({
                attempt,
                questions: mappedQuestions,
                answers: answers.map(a => ({
                    question_id: a.question_id,
                    user_answer: a.choice,
                    flagged: a.flagged || false,
                }))
            }))
        };

    } catch (error: any) {
        console.error('Error fetching quiz data:', error);
        return { success: false, error: `Failed to load quiz: ${error.message}` };
    }
}

/**
 * Clean stem text — remove PDF extraction artifacts (page numbers, headers).
 */
function cleanStem(stem: string | null): string {
    if (!stem) return 'Questão sem enunciado';

    let cleaned = stem;

    // Remove leading garbage: sequences of numbers/dots/ellipsis before question number
    // e.g. "2 2023 ... 31 2024 ... 57   1)Assinale..."
    cleaned = cleaned.replace(/^[\d\s.…]+(?=\d+\))/m, '');

    // Remove leading question number "1)" or "57)"
    cleaned = cleaned.replace(/^\s*\d+\)\s*/, '');

    // Trim
    cleaned = cleaned.trim();

    return cleaned || 'Questão sem enunciado';
}

export async function saveAnswerAction(attemptId: string, questionId: string, answer: string, isCorrect: boolean, questionIndex: number) {
    try {
        await query(`
             INSERT INTO attempt_answers (attempt_id, question_id, choice, is_correct, question_index, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (attempt_id, question_index) DO UPDATE 
             SET choice = EXCLUDED.choice,
                 is_correct = EXCLUDED.is_correct,
                 updated_at = NOW()
        `, [attemptId, questionId, answer, isCorrect, questionIndex]);
        return { success: true };
    } catch (error) {
        console.error('Save Answer Error', error);
        return { success: false };
    }
}

export async function finishQuizAction(attemptId: string, stats: any) {
    try {
        const { rows: attemptRows } = await query('SELECT user_id, config FROM attempts WHERE id = $1', [attemptId]);
        const userId = attemptRows[0]?.user_id;
        const config = attemptRows[0]?.config || {};

        await query(`
            UPDATE attempts
            SET status = 'COMPLETED',
                completed_at = NOW(),
                correct_answers = $2,
                percentage = $3,
                timer_seconds = $4
            WHERE id = $1
        `, [attemptId, stats.correctCount, stats.percentage, stats.timeSpent]);

        // Log study time (wrapped in try/catch so it doesn't crash the quiz)
        if (userId && stats.timeSpent > 0) {
            try {
                const { logStudyTime } = await import('@/lib/study-time-service');
                await logStudyTime(userId, 'quiz', stats.timeSpent, {
                    attemptId,
                    percentage: stats.percentage,
                    correctCount: stats.correctCount,
                });
            } catch (e) {
                console.warn('Failed to log study time:', e);
            }
        }

        // Schedule spaced reviews
        if (userId && config.area && config.area !== 'todas') {
            try {
                const { scheduleSpacedReviews } = await import('@/lib/spaced-review-service');
                const todayStr = new Date().toLocaleDateString('en-CA');
                await scheduleSpacedReviews({
                    userId,
                    area: config.area,
                    completedDate: todayStr,
                    sourceType: 'quiz',
                });
            } catch (e) {
                console.warn('Failed to schedule reviews:', e);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Finish Quiz Error', error);
        return { success: false };
    }
}
