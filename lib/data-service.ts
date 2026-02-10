import { supabase } from '@/lib/supabase';
import { normalizeArray } from '@/lib/utils';

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

// Data Access Layer
export const dataService = {
    /**
     * Obtém filtros disponíveis baseados nos dados reais do banco
     */
    async getAvailableFilters() {
        try {
            // Buscar dados brutos para agregar (em produção ideal seria via RPC ou view)
            const { data, error } = await supabase
                .from('documents')
                .select('institution, year, area')
                .eq('type', 'PROVA');

            if (error) throw error;

            // Sets para valores únicos
            const institutions = new Set<string>();
            const years = new Set<number>();
            const areas = new Set<string>();

            data?.forEach(doc => {
                if (doc.institution) institutions.add(doc.institution);
                if (doc.year) years.add(doc.year);
                if (doc.area) areas.add(doc.area);
            });

            return {
                institutions: Array.from(institutions).sort(),
                years: Array.from(years).sort((a, b) => b - a),
                areas: Array.from(areas).sort()
            };
        } catch (error) {
            console.error('Error fetching available filters:', error);
            return null;
        }
    },

    // Documents
    async searchDocuments(filters: DocumentFilters = {}) {
        const {
            query,
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

        let queryBuilder = supabase
            .from('documents')
            .select('*', { count: 'exact' });

        if (query) {
            queryBuilder = queryBuilder.ilike('title', `%${query}%`);
        }

        if (types && types.length > 0) {
            queryBuilder = queryBuilder.in('type', types);
        }

        if (years && years.length > 0) {
            queryBuilder = queryBuilder.in('year', years);
        }

        if (program) {
            queryBuilder = queryBuilder.or(
                `program.ilike.%${program}%,institution.ilike.%${program}%`
            );
        }

        if (area) {
            queryBuilder = queryBuilder.eq('area', area);
        }

        if (tags && tags.length > 0) {
            queryBuilder = queryBuilder.contains('tags', tags);
        }

        if (hasAnswerKey !== undefined) {
            queryBuilder = queryBuilder.eq('has_answer_key', hasAnswerKey);
        }

        // Sorting
        const [sortField, sortDirection] = sort.split('_');
        queryBuilder = queryBuilder.order(
            sortField === 'year' ? 'year' : 'title',
            { ascending: sortDirection === 'asc', nullsFirst: false }
        );

        // Pagination
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        queryBuilder = queryBuilder.range(from, to);

        const { data, error, count } = await queryBuilder;

        if (error) throw error;

        return {
            data: (data || []).map((doc) => ({
                ...doc,
                tags: normalizeArray(doc.tags),
            })) as Document[],
            count: count || 0,
            page,
            totalPages: Math.ceil((count || 0) / limit),
        };
    },

    async getDocument(docId: string) {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', docId)
            .single();

        if (error) throw error;

        return {
            ...data,
            tags: normalizeArray(data.tags),
        } as Document;
    },

    // Attempts
    async createAttempt(config: AttemptConfig, userId: string) {
        const { data, error } = await supabase
            .from('attempts')
            .insert({
                user_id: userId,
                config: config,
                status: 'in_progress',
                total_questions: config.questionCount || 0,
                started_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating attempt:', error);
            throw error;
        }
        return data as Attempt;
    },

    async getAttempt(attemptId: string) {
        const { data, error } = await supabase
            .from('attempts')
            .select('*')
            .eq('id', attemptId)
            .single();

        if (error) throw error;
        return data as Attempt;
    },

    async finalizeAttempt(attemptId: string) {
        const { data, error } = await supabase
            .from('attempts')
            .update({
                completed_at: new Date().toISOString(),
                status: 'COMPLETED',
            })
            .eq('id', attemptId)
            .select()
            .single();

        if (error) throw error;
        return data as Attempt;
    },

    async getUserHistory(userId: string, limit = 20) {
        const { data, error } = await supabase
            .from('attempts')
            .select('*')
            .eq('user_id', userId)
            .order('started_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []) as Attempt[];
    },

    // Attempt Answers
    async upsertAttemptAnswer(answer: Partial<AttemptAnswer> & {
        attempt_id: string;
        question_index: number;
    }) {
        const { data, error } = await supabase
            .from('attempt_answers')
            .upsert(
                {
                    ...answer,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'attempt_id,question_index',
                }
            )
            .select()
            .single();

        if (error) throw error;
        return data as AttemptAnswer;
    },

    async getAttemptAnswers(attemptId: string) {
        const { data, error } = await supabase
            .from('attempt_answers')
            .select('*')
            .eq('attempt_id', attemptId)
            .order('question_index');

        if (error) throw error;
        return (data || []) as AttemptAnswer[];
    },

    // Questions
    async getQuestionsByDocument(documentId: string) {
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .eq('document_id', documentId)
            .order('number_in_exam');

        if (error) throw error;
        return (data || []) as Question[];
    },

    async getQuestion(questionId: string) {
        const { data, error } = await supabase
            .from('questions')
            .select('*')
            .eq('id', questionId)
            .single();

        if (error) throw error;
        return data as Question;
    },

    // User Preferences
    async getUserPreferences(userId: string) {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async updateUserPreferences(userId: string, preferences: any) {
        const { data, error } = await supabase
            .from('user_preferences')
            .upsert({
                user_id: userId,
                ...preferences,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },
};
