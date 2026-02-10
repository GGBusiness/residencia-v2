import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserProfile {
    area: string;
    totalAnswered: number;
    correctCount: number;
    accuracy: number;
    priorityLevel: number;
    lastPracticed: Date | null;
}

interface RecommendationConfig {
    userId: string;
    questionCount: number;
    focusMode?: 'balanced' | 'weak_areas' | 'review' | 'exploration';
}

export class AIRecommendationEngine {

    /**
     * Algoritmo tipo rede social:
     * - Analisa performance histórica
     * - Identifica áreas fracas
     * - Recomenda questões personalizadas
     * - Aprende com cada interação
     */
    async generateRecommendations(config: RecommendationConfig) {
        const { userId, questionCount, focusMode = 'balanced' } = config;

        // 1. Buscar perfil do usuário
        const profile = await this.getUserProfile(userId);

        // 2. Classificar áreas
        const classified = this.classifyAreas(profile);

        // 3. Definir distribuição baseada no modo
        const distribution = this.getDistribution(focusMode, questionCount, classified);

        // 4. Buscar questões não respondidas
        const questions = await this.fetchQuestions(userId, distribution);

        // 5. Salvar recomendação para análise futura
        await this.saveRecommendation(userId, questions, {
            focusMode,
            distribution,
            reasoning: classified,
        });

        return questions;
    }

    private async getUserProfile(userId: string): Promise<UserProfile[]> {
        const { data, error } = await supabase
            .from('user_knowledge_profile')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;

        return (data || []).map((d: any) => ({
            area: d.area,
            totalAnswered: d.total_answered,
            correctCount: d.correct_count,
            accuracy: d.accuracy_percentage,
            priorityLevel: d.priority_level,
            lastPracticed: d.last_practiced_at,
        }));
    }

    private classifyAreas(profile: UserProfile[]) {
        const critical = profile.filter(p => p.accuracy < 60).map(p => p.area);     // <60%
        const needsAttention = profile.filter(p => p.accuracy >= 60 && p.accuracy < 75).map(p => p.area);  // 60-75%
        const good = profile.filter(p => p.accuracy >= 75 && p.accuracy < 85).map(p => p.area);  // 75-85%
        const excellent = profile.filter(p => p.accuracy >= 85).map(p => p.area);    // >85%

        // Áreas nunca praticadas
        const allAreas = ['Cirurgia', 'Clínica Médica', 'GO', 'Pediatria', 'Medicina Preventiva'];
        const practicedAreas = profile.map(p => p.area);
        const untouched = allAreas.filter(a => !practicedAreas.includes(a));

        return {
            critical,        // Prioridade máxima
            needsAttention,  // Alta prioridade
            good,            // Revisão
            excellent,       // Manutenção
            untouched,       // Exploração
        };
    }

    private getDistribution(mode: string, total: number, classified: any) {
        let crit = 0, attention = 0, review = 0, exploration = 0;

        switch (mode) {
            case 'weak_areas':
                // Foco total em áreas fracas
                crit = Math.ceil(total * 0.8);
                attention = Math.ceil(total * 0.2);
                break;

            case 'review':
                // Revisar áreas já boas
                review = Math.ceil(total * 0.7);
                attention = Math.ceil(total * 0.3);
                break;

            case 'exploration':
                // Explorar novas áreas
                exploration = Math.ceil(total * 0.6);
                review = Math.ceil(total * 0.4);
                break;

            case 'balanced':
            default:
                // Algoritmo balanceado (tipo feed de rede social)
                crit = Math.floor(total * 0.4);           // 40% áreas críticas
                attention = Math.floor(total * 0.3);      // 30% precisa atenção
                review = Math.floor(total * 0.2);         // 20% revisão
                exploration = total - crit - attention - review;  // 10% exploração
                break;
        }

        return {
            critical: { count: crit, areas: classified.critical },
            attention: { count: attention, areas: classified.needsAttention },
            review: { count: review, areas: classified.good },
            exploration: { count: exploration, areas: classified.untouched },
        };
    }

    private async fetchQuestions(userId: string, distribution: any) {
        const questions: any[] = [];

        // Buscar questões NÃO respondidas pelo usuário
        const { data: answeredIds } = await supabase
            .from('user_answered_questions')
            .select('question_id')
            .eq('user_id', userId);

        const excludeIds = (answeredIds || []).map((a: any) => a.question_id);

        // Função auxiliar para buscar por área
        const fetchByArea = async (areas: string[], count: number) => {
            if (areas.length === 0 || count === 0) return [];

            const perArea = Math.ceil(count / areas.length);
            const results = [];

            for (const area of areas) {
                let query = supabase
                    .from('questions')
                    .select('*')
                    .eq('area', area);

                if (excludeIds.length > 0) {
                    query = query.not('id', 'in', `(${excludeIds.map(id => `'${id}'`).join(',')})`);
                }

                const { data } = await query.limit(perArea);
                if (data) results.push(...data);
            }

            return results.slice(0, count);
        };

        // Buscar de cada categoria
        const critical = await fetchByArea(distribution.critical.areas, distribution.critical.count);
        const attention = await fetchByArea(distribution.attention.areas, distribution.attention.count);
        const review = await fetchByArea(distribution.review.areas, distribution.review.count);
        const exploration = await fetchByArea(distribution.exploration.areas, distribution.exploration.count);

        questions.push(...critical, ...attention, ...review, ...exploration);

        // Embaralhar para não ficar agrupado por área
        return this.shuffle(questions);
    }

    private shuffle(array: any[]) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    private async saveRecommendation(userId: string, questions: any[], metadata: any) {
        const questionIds = questions.map(q => q.id);

        await supabase
            .from('ai_recommendations')
            .insert({
                user_id: userId,
                question_ids: questionIds,
                reasoning: metadata,
            });
    }

    /**
     * Salvar performance de uma questão
     * Auto-atualiza perfil via trigger SQL
     */
    async savePerformance(data: {
        userId: string;
        questionId: string;
        attemptId: string;
        userAnswer: string;
        correct: boolean;
        timeSpentSeconds: number;
        area: string;
        subarea?: string;
        difficulty: string;
        institution: string;
        year: number;
    }) {
        const { error } = await supabase
            .from('user_performance')
            .insert({
                user_id: data.userId,
                question_id: data.questionId,
                attempt_id: data.attemptId,
                user_answer: data.userAnswer,
                correct: data.correct,
                time_spent_seconds: data.timeSpentSeconds,
                area: data.area,
                subarea: data.subarea,
                difficulty: data.difficulty,
                institution: data.institution,
                year: data.year,
            });

        if (error) throw error;
    }

    /**
     * Obter insights do perfil
     */
    async getInsights(userId: string) {
        // Perfil completo
        const { data: profile } = await supabase
            .from('user_knowledge_profile')
            .select('*')
            .eq('user_id', userId)
            .order('priority_level', { ascending: true });

        // Histórico de evolução (últimos 30 dias)
        const { data: history } = await supabase
            .from('user_evolution_history')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(30);

        // Performance recente (últimas 50 questões)
        const { data: recentPerf } = await supabase
            .from('user_performance')
            .select('*')
            .eq('user_id', userId)
            .order('answered_at', { ascending: false })
            .limit(50);

        // Calcular estatísticas globais
        const totalQuestions = profile?.reduce((sum: number, p: any) => sum + p.total_answered, 0) || 0;
        const totalCorrect = profile?.reduce((sum: number, p: any) => sum + p.correct_count, 0) || 0;
        const globalAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions * 100) : 0;

        return {
            profile,
            history,
            recentPerformance: recentPerf,
            globalStats: {
                totalQuestions,
                totalCorrect,
                globalAccuracy: globalAccuracy.toFixed(2),
            },
        };
    }
}

// Singleton exportado
export const aiEngine = new AIRecommendationEngine();
