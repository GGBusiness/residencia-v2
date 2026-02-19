'use server';

import { db, query } from '@/lib/db';
import { normalizeArray } from '@/lib/utils';
import { unstable_noStore as noStore } from 'next/cache';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

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

/**
 * Obtém filtros disponíveis baseados nos dados reais do banco com fallbacks seguros
 */
export async function getAvailableFilters() {
    noStore();
    try {
        const { rows: instRows } = await query('SELECT DISTINCT institution FROM documents WHERE institution IS NOT NULL ORDER BY institution');
        const { rows: yearRows } = await query('SELECT DISTINCT year FROM documents WHERE year IS NOT NULL ORDER BY year DESC');

        // Areas from both tables to be safe
        const { rows: qAreas } = await query('SELECT DISTINCT area FROM questions WHERE area IS NOT NULL');
        const { rows: dAreas } = await query('SELECT DISTINCT area FROM documents WHERE area IS NOT NULL');

        const areaSet = new Set([...qAreas.map(r => r.area), ...dAreas.map(r => r.area)]);
        let areas = Array.from(areaSet).filter(a => a !== 'Geral' && a !== 'Todas as áreas').sort();

        // Institutions - STRICT DB ONLY
        let institutions = instRows.map(r => r.institution).filter(Boolean).sort();

        // If DB is empty, use defaults just to avoid breaking UI, but prefer DB
        if (institutions.length === 0) {
            const defaultInstitutions = [
                'ENARE', 'USP', 'USP-RP', 'UNICAMP', 'SUS-SP', 'SCMSA',
                'AMRIGS', 'PSU-MG', 'UFRJ', 'UERJ', 'UNIFESP', 'IAMSPE'
            ];
            institutions = defaultInstitutions.sort();
        }

        // Years - STRICT DB ONLY
        let years = yearRows.map(r => r.year).filter(y => y != null).sort((a, b) => b - a);

        if (years.length === 0) {
            years = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
        }

        // Areas - STRICT DB ONLY
        if (areas.length === 0) {
            areas = [
                'Cirurgia Geral', 'Clínica Médica', 'Ginecologia e Obstetrícia',
                'Pediatria', 'Medicina Preventiva', 'Medicina de Família e Comunidade'
            ];
        } else {
            // Optional: still merge defaults for areas as they are standard, 
            // but user specifically complained about Institutions/Years
            const defaultAreas = [
                'Cirurgia Geral', 'Clínica Médica', 'Ginecologia e Obstetrícia',
                'Pediatria', 'Medicina Preventiva', 'Medicina de Família e Comunidade'
            ];
            areas = Array.from(new Set([...areas, ...defaultAreas])).sort();
        }

        return {
            institutions,
            years,
            areas
        };
    } catch (error) {
        console.error('Error fetching available filters:', error);
        // Emergency Fallback
        return {
            institutions: ['ENARE', 'USP', 'USP-RP', 'UNICAMP', 'SUS-SP', 'PSU-MG', 'UFRJ', 'UNIFESP'],
            years: [2026, 2025, 2024, 2023, 2022, 2021, 2020],
            areas: ['Cirurgia Geral', 'Clínica Médica', 'Ginecologia e Obstetrícia', 'Pediatria', 'Medicina Preventiva']
        };
    }
}

// Documents
export async function searchDocuments(filters: DocumentFilters = {}) {
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
}

export async function getDocument(docId: string) {
    noStore();
    const { rows } = await query('SELECT * FROM documents WHERE id = $1', [docId]);
    const data = rows[0];

    if (!data) throw new Error('Document not found');

    return {
        ...data,
        tags: normalizeArray(data.tags),
    } as Document;
}

// Attempts
export async function createAttempt(config: AttemptConfig, userId: string) {
    // Obter user real
    // Nota: para endpoints seguros, deveríamos validar a sessão aqui também,
    // mas assumimos que o chamador (Page/Action) já validou.

    const { rows } = await query(`
        INSERT INTO attempts (user_id, attempt_type, config, status, total_questions, started_at)
        VALUES ($1, $2, $3, 'IN_PROGRESS', $4, NOW())
        RETURNING *
    `, [userId, config.mode || 'CUSTOM', JSON.stringify(config), config.questionCount || 0]);

    return rows[0] as Attempt;
}

export async function getAttempt(attemptId: string) {
    noStore();
    const { rows } = await query('SELECT * FROM attempts WHERE id = $1', [attemptId]);
    if (!rows[0]) throw new Error('Attempt not found');
    return rows[0] as Attempt;
}

export async function finalizeAttempt(attemptId: string) {
    const { rows } = await query(`
        UPDATE attempts 
        SET completed_at = NOW(), status = 'COMPLETED'
        WHERE id = $1
        RETURNING *
    `, [attemptId]);
    return rows[0] as Attempt;
}

export async function getUserHistory(userId: string, limit = 20) {
    noStore();
    const { rows } = await query(`
        SELECT * FROM attempts 
        WHERE user_id = $1 
        ORDER BY started_at DESC
        LIMIT $2
    `, [userId, limit]);
    return rows as Attempt[];
}

// Attempt Answers
export async function upsertAttemptAnswer(answer: Partial<AttemptAnswer> & {
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
}

export async function getAttemptAnswers(attemptId: string) {
    noStore();
    const { rows } = await query(`
        SELECT * FROM attempt_answers 
        WHERE attempt_id = $1 
        ORDER BY question_index
    `, [attemptId]);
    return rows as AttemptAnswer[];
}

// Questions
export async function getQuestionsByDocument(documentId: string) {
    noStore();
    const { rows } = await query(`
        SELECT * FROM questions 
        WHERE document_id = $1 
        ORDER BY number_in_exam
    `, [documentId]);
    return rows as Question[];
}

export async function getQuestion(questionId: string) {
    noStore();
    const { rows } = await query('SELECT * FROM questions WHERE id = $1', [questionId]);
    if (!rows[0]) throw new Error('Question not found');
    return rows[0] as Question;
}

// User Preferences
export async function getUserPreferences(userId: string) {
    noStore();
    const { rows } = await query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    return rows[0];
}

export async function updateUserPreferences(userId: string, preferences: any) {
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
}


// Knowledge Ingestion (Server-side PDF processing)
export async function ingestKnowledgeFile(formData: FormData) {
    'use server';
    noStore();

    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');
    if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI key missing');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
        const data = await pdf(buffer);
        const text = data.text;
        const fileName = file.name;

        // 1. Meta
        const { rows: docRows } = await query(`
            INSERT INTO knowledge_docs (title, file_name, file_type, source_url)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [fileName.replace('.pdf', ''), fileName, 'pdf', 'web-upload']);

        const docId = docRows[0].id;

        // 2. Chunks
        const chunks: string[] = [];
        let start = 0;
        const cleanText = text.replace(/\s+/g, ' ').trim();
        const chunkSize = 1000;
        const overlap = 200;

        while (start < cleanText.length) {
            const end = Math.min(start + chunkSize, cleanText.length);
            let chunk = cleanText.substring(start, end);
            chunks.push(chunk);
            start += chunk.length - overlap;
        }

        // 3. Embeddings & Save (Batching to avoid timeouts)
        for (const chunk of chunks) {
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: chunk.replace(/\n/g, ' '),
                dimensions: 1536,
            });
            const embedding = response.data[0].embedding;

            await query(`
                INSERT INTO knowledge_embeddings (doc_id, content, embedding)
                VALUES ($1, $2, $3)
            `, [docId, chunk, JSON.stringify(embedding)]);
        }

        return { success: true, docId };
    } catch (error) {
        console.error('Ingestion error:', error);
        throw error;
    }
}

// Backward compatibility object
export const dataService = {
    getAvailableFilters,
    searchDocuments,
    getDocument,
    createAttempt,
    getAttempt,
    finalizeAttempt,
    getUserHistory,
    upsertAttemptAnswer,
    getAttemptAnswers,
    getQuestionsByDocument,
    getQuestion,
    getUserPreferences,
    updateUserPreferences,
    ingestKnowledgeFile
};
