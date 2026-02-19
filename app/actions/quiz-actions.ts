'use server';

import { db, query } from '@/lib/db';

export interface QuizData {
    attempt: any;
    questions: any[];
    answers: any[];
}

export async function getQuizDataAction(attemptId: string): Promise<{ success: boolean; data?: QuizData; error?: string }> {
    try {
        // 1. Get Attempt
        const { rows: attempts } = await query('SELECT * FROM attempts WHERE id = $1', [attemptId]);
        const attempt = attempts[0];
        if (!attempt) return { success: false, error: 'Attempt not found' };

        // 2. Get Questions based on Config
        // Note: usage of config to filter questions
        const config = attempt.config || {};
        let sql = 'SELECT * FROM questions WHERE 1=1';
        const params: any[] = [];
        let pIndex = 1;

        if (config.area && config.area !== 'todas') {
            sql += ` AND area = $${pIndex}`;
            params.push(config.area);
            pIndex++;
        }

        if (config.difficulty && config.difficulty !== 'todas') {
            sql += ` AND difficulty ILIKE $${pIndex}`;
            params.push(`%${config.difficulty}%`);
            pIndex++;
        }

        // Add limit
        sql += ` LIMIT $${pIndex}`;
        params.push(config.questionCount || 20);

        const { rows: questions } = await query(sql, params);

        // 2b. If no questions found, insert a dummy one for testing if table is empty
        if (questions.length === 0) {
            // Check if table is truly empty
            const { rows: count } = await query('SELECT COUNT(*) FROM questions');
            if (parseInt(count[0].count) === 0) {
                await query(`
                    INSERT INTO documents (title, type, year, institution, area)
                    VALUES ('Prova Exemplo', 'PROVA', 2024, 'ENARE', 'CLINICA')
                `);

                const { rows: docs } = await query('SELECT id FROM documents LIMIT 1');
                const docId = docs[0].id;

                await query(`
                    INSERT INTO questions (document_id, stem, option_a, option_b, option_c, option_d, correct_option, area, difficulty)
                    VALUES ($1, 'Qual é a capital da França?', 'Londres', 'Berlim', 'Paris', 'Madrid', 'C', 'CLINICA', 'FACIL')
                `, [docId]);

                // Re-query
                const { rows: retry } = await query(sql, params);
                questions.push(...retry);
            }
        }

        // Map DB fields to Frontend fields
        const mappedQuestions = questions.map(q => ({
            id: q.id,
            institution: 'Simulado', // Join with document if needed, for now placeholder or query needs join
            year: 2024,
            area: q.area || 'Geral',
            difficulty: q.difficulty || 'Media',
            question_text: q.stem,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            option_e: q.option_e,
            correct_answer: q.correct_option,
            explanation: q.explanation
        }));

        // 3. Get Answers
        const { rows: answers } = await query('SELECT * FROM attempt_answers WHERE attempt_id = $1', [attemptId]);

        return {
            success: true,
            data: {
                attempt,
                questions: mappedQuestions,
                answers: answers.map(a => ({
                    question_id: a.question_id || questions[a.question_index]?.id, // fallback approach
                    user_answer: a.choice,
                    flagged: a.flagged
                }))
            }
        };

    } catch (error) {
        console.error('Error fetching quiz data:', error);
        return { success: false, error: 'Failed to load quiz' };
    }
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
        // Get user_id and config from attempt before updating
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

        // Log study time automatically
        if (userId && stats.timeSpent > 0) {
            const { logStudyTime } = await import('@/lib/study-time-service');
            await logStudyTime(userId, 'quiz', stats.timeSpent, {
                attemptId,
                percentage: stats.percentage,
                correctCount: stats.correctCount,
            });
        }

        // Schedule spaced reviews for the quiz area
        if (userId && config.area && config.area !== 'todas') {
            const { scheduleSpacedReviews } = await import('@/lib/spaced-review-service');
            const todayStr = new Date().toLocaleDateString('en-CA');
            await scheduleSpacedReviews({
                userId,
                area: config.area,
                completedDate: todayStr,
                sourceType: 'quiz',
            });
        }

        return { success: true };
    } catch (error) {
        console.error('Finish Quiz Error', error);
        return { success: false };
    }
}
