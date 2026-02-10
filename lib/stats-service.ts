import { supabase } from './supabase';

export interface CutScore {
    institution: string;
    area: string;
    year: number;
    total_questions: number;
    passing_score: number;
    percentage: number;
}

export interface UserStats {
    totalAttempts: number;
    totalQuestions: number;
    totalCorrect: number;
    averagePercentage: number;
    statsByArea: Record<string, { correct: number; total: number; percentage: number }>;
    statsByDifficulty: Record<string, { correct: number; total: number; percentage: number }>;
}

// Buscar nota de corte
export async function getCutScore(
    institution: string,
    area: string
): Promise<CutScore | null> {
    const { data, error } = await supabase
        .from('cut_scores')
        .select('*')
        .eq('institution', institution)
        .eq('area', area)
        .order('year', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return null;
    return data as CutScore;
}

// Calcular estatísticas do usuário
export async function getUserStats(userId: string = '00000000-0000-0000-0000-000000000001'): Promise<UserStats> {
    // Buscar todos attempts do usuário
    const { data: attempts, error } = await supabase
        .from('attempts')
        .select('*, attempt_answers(*)')
        .eq('user_id', userId)
        .eq('status', 'COMPLETED');

    if (error || !attempts) {
        return {
            totalAttempts: 0,
            totalQuestions: 0,
            totalCorrect: 0,
            averagePercentage: 0,
            statsByArea: {},
            statsByDifficulty: {},
        };
    }

    let totalQuestions = 0;
    let totalCorrect = 0;
    const statsByArea: Record<string, { correct: number; total: number; percentage: number }> = {};
    const statsByDifficulty: Record<string, { correct: number; total: number; percentage: number }> = {};

    // Processar cada attempt
    for (const attempt of attempts) {
        const answers = attempt.attempt_answers || [];
        const area = attempt.config?.area || 'geral';
        const difficulty = attempt.config?.difficulty || 'mista';

        // Contar respostas (mocado - em produção viria do banco)
        const questionsInAttempt = answers.length;
        const correctInAttempt = answers.filter((a: any) => a.is_correct).length;

        totalQuestions += questionsInAttempt;
        totalCorrect += correctInAttempt;

        // Agrupar por área
        if (!statsByArea[area]) {
            statsByArea[area] = { correct: 0, total: 0, percentage: 0 };
        }
        statsByArea[area].correct += correctInAttempt;
        statsByArea[area].total += questionsInAttempt;

        // Agrupar por dificuldade
        if (!statsByDifficulty[difficulty]) {
            statsByDifficulty[difficulty] = { correct: 0, total: 0, percentage: 0 };
        }
        statsByDifficulty[difficulty].correct += correctInAttempt;
        statsByDifficulty[difficulty].total += questionsInAttempt;
    }

    // Calcular percentuais área
    Object.keys(statsByArea).forEach(area => {
        statsByArea[area].percentage =
            statsByArea[area].total > 0
                ? (statsByArea[area].correct / statsByArea[area].total) * 100
                : 0;
    });

    // Calcular percentuais dificuldade
    Object.keys(statsByDifficulty).forEach(diff => {
        statsByDifficulty[diff].percentage =
            statsByDifficulty[diff].total > 0
                ? (statsByDifficulty[diff].correct / statsByDifficulty[diff].total) * 100
                : 0;
    });

    const averagePercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

    return {
        totalAttempts: attempts.length,
        totalQuestions,
        totalCorrect,
        averagePercentage,
        statsByArea,
        statsByDifficulty,
    };
}

// Calcular projeção de acertos
export function calculateProjection(
    answeredCorrect: number,
    answeredTotal: number,
    totalQuestions: number
): number {
    if (answeredTotal === 0) return 0;
    const currentPercent = answeredCorrect / answeredTotal;
    return Math.round(currentPercent * totalQuestions);
}

// Gerar recomendações baseadas em performance
export function generateRecommendations(stats: UserStats, cutScores: CutScore[]): string[] {
    const recommendations: string[] = [];

    // Analisar cada área
    Object.entries(stats.statsByArea).forEach(([area, areaStats]) => {
        const cutScore = cutScores.find(cs => cs.area === area);
        if (!cutScore) return;

        const difference = areaStats.percentage - cutScore.percentage;

        if (difference < -20) {
            recommendations.push(`🚨 URGENTE: ${area} está ${Math.abs(difference).toFixed(0)}% abaixo da meta. Priorize esta área!`);
        } else if (difference < -10) {
            recommendations.push(`⚠️ ${area}: Precisa melhorar ${Math.abs(difference).toFixed(0)}%. Dedique 3-4h/semana.`);
        } else if (difference < 0) {
            recommendations.push(`📚 ${area}: Quase lá! Mais ${Math.abs(difference).toFixed(0)}% para atingir a meta.`);
        } else {
            recommendations.push(`✅ ${area}: Excelente! ${difference.toFixed(0)}% acima da meta. Mantenha.`);
        }
    });

    // Recomendação geral
    if (stats.averagePercentage < 60) {
        recommendations.push('💡 Sugestão: Foque em conceitos fundamentais antes de simulados complexos.');
    } else if (stats.averagePercentage < 75) {
        recommendations.push('💡 Sugestão: Aumente o volume de simulados para fixar o conteúdo.');
    } else {
        recommendations.push('💡 Sugestão: Mantenha o ritmo e refine detalhes! Você está no caminho certo.');
    }

    return recommendations;
}
