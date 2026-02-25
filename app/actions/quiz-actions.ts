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

        // 3. Map DB fields to Frontend fields — clean all text at runtime
        // Also shuffle options so correct answer isn't always in the same position
        const mappedQuestions = questions.map(q => {
            const rawOptions = [
                { key: 'A', text: cleanOption(q.option_a) || '' },
                { key: 'B', text: cleanOption(q.option_b) || '' },
                { key: 'C', text: cleanOption(q.option_c) || '' },
                { key: 'D', text: cleanOption(q.option_d) || '' },
            ];
            // Only add E if it exists
            if (q.option_e) {
                const cleanedE = cleanOption(q.option_e);
                if (cleanedE) rawOptions.push({ key: 'E', text: cleanedE });
            }

            // Shuffle options using question ID as seed for consistency
            const shuffled = shuffleOptions(rawOptions, q.id);

            // Find where the correct answer ended up after shuffle
            const originalCorrect = q.correct_option; // 'A', 'B', etc.
            const newCorrectIdx = shuffled.findIndex(o => o.key === originalCorrect);
            const newCorrectLetter = ['A', 'B', 'C', 'D', 'E'][newCorrectIdx] || originalCorrect;

            return {
                id: q.id,
                institution: q.institution || q.doc_title || 'Prova',
                year: q.doc_year || 0,
                area: q.area || 'Geral',
                subarea: q.subarea || '',
                difficulty: 'Média',
                question_text: cleanStem(q.stem),
                option_a: shuffled[0]?.text || '',
                option_b: shuffled[1]?.text || '',
                option_c: shuffled[2]?.text || '',
                option_d: shuffled[3]?.text || '',
                option_e: shuffled[4]?.text || null,
                correct_answer: newCorrectLetter,
                explanation: q.explanation || 'Explicação não disponível para esta questão.',
            };
        });

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
 * Strip known PDF garbage patterns from any text at runtime.
 * This is a second line of defense after the DB cleanup scripts.
 */
function stripGarbage(text: string): string {
    let cleaned = text;
    // Remove GABARITO text and everything after (case variations)
    cleaned = cleaned.replace(/\s*GABARITO[\s\S]*$/, '');
    cleaned = cleaned.replace(/\s*Gabarito[\s\S]*$/, '');
    cleaned = cleaned.replace(/\s*gabarito[\s\S]*$/, '');
    // Remove "Medway - ENARE - 2026" headers and everything after
    cleaned = cleaned.replace(/\s*Medway\s*[-–][\s\S]*$/, '');
    // Remove "Páginas X/Y" and everything after
    cleaned = cleaned.replace(/\s*P[aá]ginas?\s*\d+\/\d+[\s\S]*$/, '');
    cleaned = cleaned.replace(/\s*P[aá]gina\s*\d+\s*de\s*\d+[\s\S]*$/, '');
    // Remove next question bleeding: "84) O médico..." (a digit+paren followed by 20+ chars at end)
    cleaned = cleaned.replace(/\s*\d+\)\s+[A-Z][a-záéíóúàãõâêôç][\s\S]{20,}$/, '');
    // Remove "QUESTÃO X" bleeding (case variations)
    cleaned = cleaned.replace(/\s*QUEST[ÃA]O\s+\d+[\s\S]*$/, '');
    cleaned = cleaned.replace(/\s*Quest[ãa]o\s+\d+[\s\S]*$/, '');
    // Remove trailing loose numbers/dots
    cleaned = cleaned.replace(/\s+\d+\.\s*$/, '');
    return cleaned.trim();
}

/**
 * Clean stem text — remove PDF extraction artifacts.
 */
function cleanStem(stem: string | null): string {
    if (!stem) return 'Questão sem enunciado';
    let cleaned = stem;

    // Remove leading garbage: sequences of numbers/dots/ellipsis
    cleaned = cleaned.replace(/^[\d\s.…]+(?=\d+\))/m, '');
    // Remove leading question number "1)" or "57)"
    cleaned = cleaned.replace(/^\s*\d+\)\s*/, '');
    // Remove leading "1. " or "57. "
    cleaned = cleaned.replace(/^\s*\d+\.\s+/, '');
    // Remove institution headers at start
    cleaned = cleaned.replace(/^(ENARE|USP|UNICAMP|UNIFESP|SUS-SP|PSU|UNESP|UFES|UFRJ|ISCMSP|enare|usp|unicamp|unifesp)\s*\d{4}[^A-Za-zÀ-ú]*/, '');
    // Remove "A B C D E" header
    cleaned = cleaned.replace(/^[Aa] [Bb] [Cc] [Dd] [Ee]\s*/, '');

    // Strip garbage patterns
    cleaned = stripGarbage(cleaned);

    return cleaned.trim() || 'Questão sem enunciado';
}

/**
 * Clean option text — remove PDF garbage that bled into options.
 */
function cleanOption(option: string | null): string | null {
    if (!option) return null;
    const cleaned = stripGarbage(option);
    return cleaned.length > 1 ? cleaned : null;
}

/**
 * Shuffle options using a seeded random based on question ID.
 * This ensures the same question always gets the same shuffle
 * (stable across page reloads) but different questions get different orders.
 */
function shuffleOptions(options: { key: string; text: string }[], seed: string): { key: string; text: string }[] {
    const arr = [...options];
    // Simple hash from string to number
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32-bit integer
    }
    // Fisher-Yates shuffle with seeded random
    let m = arr.length;
    while (m > 0) {
        hash = (hash * 1103515245 + 12345) & 0x7fffffff;
        const i = hash % m;
        m--;
        [arr[m], arr[i]] = [arr[i], arr[m]];
    }
    return arr;
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
