'use server';

import { db, query } from '@/lib/db';
import { normalizeArray } from '@/lib/utils';
import { unstable_noStore as noStore } from 'next/cache';

// Tipos mantidos para compatibilidade
export interface DocumentFilters {
    query?: string;
    types?: string[];
    years?: number[];
    program?: string;
    area?: string;
    tags?: string[];
    hasAnswerKey?: boolean;
    sort?: 'year_asc' | 'year_desc' | 'title_asc' | 'title_desc';
    page?: number;
    limit?: number;
}

export interface Document {
    id: string;
    title: string;
    type: string;
    year: number | null;
    program: string | null;
    institution: string | null;
    area: string | null;
    tags: string[];
    has_answer_key: boolean;
    pdf_url: string | null;
    metadata: any;
    created_at: string;
}

export interface AttemptConfig {
    mode: 'DAILY' | 'SIMULATED' | 'CUSTOM';
    feedbackMode: 'PROVA' | 'ESTUDO';
    documentIds: string[];
    questionCount: number;
    timer?: number;
    objective?: string;
    area?: string;
    subareas?: string[];
    programs?: string[];
    years?: number[];
    difficulty?: string;
}

export interface Attempt {
    id: string;
    user_id: string;
    attempt_type: string;
    config: AttemptConfig;
    feedback_mode: 'PROVA' | 'ESTUDO';
    started_at: string;
    completed_at: string | null;
    timer_seconds: number | null;
    status: 'IN_PROGRESS' | 'COMPLETED';
}

export interface AttemptAnswer {
    id: string;
    attempt_id: string;
    question_index: number;
    choice: string | null;
    flagged: boolean;
    created_at: string;
    updated_at: string;
}

export interface Question {
    id: string;
    document_id: string;
    number_in_exam: number;
    stem: string;
    option_a: string | null;
    option_b: string | null;
    option_c: string | null;
    option_d: string | null;
    option_e: string | null;
    correct_option: string | null;
    explanation: string | null;
    area: string | null;
    subarea: string | null;
    topic: string | null;
}

// Data Access Layer (DigitalOcean Version)
export const dataService = {
    /**
     * Obtém filtros disponíveis baseados nos dados reais do banco
     */
    async getAvailableFilters() {
        noStore(); // Desabilita cache estático do Next.js
        try {
            // Aggregate queries
            const { rows: institutions } = await query('SELECT DISTINCT institution FROM documents WHERE institution IS NOT NULL ORDER BY institution');
            const { rows: years } = await query('SELECT DISTINCT year FROM documents WHERE year IS NOT NULL ORDER BY year DESC');
            const { rows: areas } = await query('SELECT DISTINCT area FROM documents WHERE area IS NOT NULL ORDER BY area');

            return {
                institutions: institutions.map(r => r.institution),
                years: years.map(r => r.year),
                areas: areas.map(r => r.area)
            };
        } catch (error) {
            console.error('Error fetching available filters:', error);
            return null;
        }
    },

    // Documents
    async searchDocuments(filters: DocumentFilters = {}) {
        noStore();
        const {
            query: textQuery,
            types,
            years,
            program,
            area,
            tags,
            hasAnswerKey,
            sort = 'year_desc',
            page = 1,
            limit = 20,
        } = filters;

        let sql = 'SELECT * FROM documents WHERE 1=1';
        const params: any[] = [];
        let pIndex = 1;

        if (textQuery) {
            sql += ` AND title ILIKE $${pIndex}`;
            params.push(`%${textQuery}%`);
            pIndex++;
        }

        if (types && types.length > 0) {
            sql += ` AND type = ANY($${pIndex}::text[])`;
            params.push(types);
            pIndex++;
        }

        if (years && years.length > 0) {
            sql += ` AND year = ANY($${pIndex}::int[])`;
            params.push(years);
            pIndex++;
        }

        if (program) {
            sql += ` AND (program ILIKE $${pIndex} OR institution ILIKE $${pIndex})`;
            params.push(`%${program}%`);
            pIndex++;
        }

        if (area) {
            sql += ` AND area = $${pIndex}`;
            params.push(area);
            pIndex++;
        }

        if (hasAnswerKey !== undefined) {
            sql += ` AND has_answer_key = $${pIndex}`;
            params.push(hasAnswerKey);
            pIndex++;
        }

        // Count total before pagination
        const countSql = `SELECT COUNT(*) as total FROM (${sql}) as sub`;
        const { rows: countRows } = await query(countSql, params);
        const count = parseInt(countRows[0].total);

        // Sorting
        const [sortField, sortDirection] = sort.split('_');
        const dir = sortDirection === 'asc' ? 'ASC' : 'DESC';
        if (sortField === 'year') {
            sql += ` ORDER BY year ${dir} NULLS LAST`;
        } else {
            sql += ` ORDER BY title ${dir}`;
        }

        // Pagination
        const offset = (page - 1) * limit;
        sql += ` LIMIT $${pIndex} OFFSET $${pIndex + 1}`;
        params.push(limit, offset);

        const { rows } = await query(sql, params);

        return {
            data: rows.map((doc) => ({
                ...doc,
                tags: normalizeArray(doc.tags),
            })) as Document[],
            count: count,
            page,
            totalPages: Math.ceil(count / limit),
        };
    },

    async getDocument(docId: string) {
        noStore();
        const { rows } = await query('SELECT * FROM documents WHERE id = $1', [docId]);
        const data = rows[0];

        if (!data) throw new Error('Document not found');

        return {
            ...data,
            tags: normalizeArray(data.tags),
        } as Document;
    },

    // Attempts
    async createAttempt(config: AttemptConfig, userId: string) {
        // Obter user real
        // Nota: para endpoints seguros, deveríamos validar a sessão aqui também,
        // mas assumimos que o chamador (Page/Action) já validou.

        const { rows } = await query(`
            INSERT INTO attempts (user_id, config, status, total_questions, started_at)
            VALUES ($1, $2, 'IN_PROGRESS', $3, NOW())
            RETURNING *
        `, [userId, JSON.stringify(config), config.questionCount || 0]);

        return rows[0] as Attempt;
    },

    async getAttempt(attemptId: string) {
        noStore();
        const { rows } = await query('SELECT * FROM attempts WHERE id = $1', [attemptId]);
        if (!rows[0]) throw new Error('Attempt not found');
        return rows[0] as Attempt;
    },

    async finalizeAttempt(attemptId: string) {
        const { rows } = await query(`
            UPDATE attempts 
            SET completed_at = NOW(), status = 'COMPLETED'
            WHERE id = $1
            RETURNING *
        `, [attemptId]);
        return rows[0] as Attempt;
    },

    async getUserHistory(userId: string, limit = 20) {
        noStore();
        const { rows } = await query(`
            SELECT * FROM attempts 
            WHERE user_id = $1 
            ORDER BY started_at DESC
            LIMIT $2
        `, [userId, limit]);
        return rows as Attempt[];
    },

    // Attempt Answers
    async upsertAttemptAnswer(answer: Partial<AttemptAnswer> & {
        attempt_id: string;
        question_index: number;
    }) {
        const { rows } = await query(`
            INSERT INTO attempt_answers (attempt_id, question_index, choice, flagged, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (attempt_id, question_index)
            DO UPDATE SET
                choice = EXCLUDED.choice,
                flagged = EXCLUDED.flagged,
                updated_at = NOW()
            RETURNING *
        `, [answer.attempt_id, answer.question_index, answer.choice || null, answer.flagged || false]);

        return rows[0] as AttemptAnswer;
    },

    async getAttemptAnswers(attemptId: string) {
        noStore();
        const { rows } = await query(`
            SELECT * FROM attempt_answers 
            WHERE attempt_id = $1 
            ORDER BY question_index
        `, [attemptId]);
        return rows as AttemptAnswer[];
    },

    // Questions
    async getQuestionsByDocument(documentId: string) {
        noStore();
        const { rows } = await query(`
            SELECT * FROM questions 
            WHERE document_id = $1 
            ORDER BY number_in_exam
        `, [documentId]);
        return rows as Question[];
    },

    async getQuestion(questionId: string) {
        noStore();
        const { rows } = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
        if (!rows[0]) throw new Error('Question not found');
        return rows[0] as Question;
    },

    // User Preferences
    async getUserPreferences(userId: string) {
        noStore();
        const { rows } = await query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
        return rows[0];
    },

    async updateUserPreferences(userId: string, preferences: any) {
        // Construir query dinâmica de update
        const keys = Object.keys(preferences);
        if (keys.length === 0) return null;

        const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
        const values = keys.map(k => preferences[k]);

        const { rows } = await query(`
            INSERT INTO user_preferences (user_id, ${keys.join(', ')})
            VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})
            ON CONFLICT (user_id) 
            DO UPDATE SET ${setClause}
            RETURNING *
        `, [userId, ...values]);

        return rows[0];
    },
};
