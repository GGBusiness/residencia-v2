'use server';

import { db, query } from './db';

// Interfaces (Mantidas)
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

// Buscar nota de corte (DigitalOcean)
export async function getCutScore(
    institution: string,
    area: string
): Promise<CutScore | null> {
    try {
        const { rows } = await query(`
            SELECT * FROM cut_scores
            WHERE institution = $1 AND area = $2
            ORDER BY year DESC
            LIMIT 1
        `, [institution, area]);

        return (rows[0] as CutScore) || null;
    } catch (error) {
        console.error('Error fetching cut score:', error);
        return null;
    }
}

// Calcular estatísticas do usuário (DigitalOcean)
export async function getUserStats(userId: string): Promise<UserStats> {
    if (!userId) return emptyStats();

    try {
        // Buscar todos attempts completados do usuário com suas respostas
        // Otimização: Fazer agragações no SQL seria melhor, mas para compatibilidade manteremos lógica JS por enquanto
        // ou buscar só o necessário.

        // Vamos buscar só os attempts e suas respostas
        const { rows: attempts } = await query(`
            SELECT a.*, 
            (
                SELECT json_agg(aa.*)
                FROM attempt_answers aa
                WHERE aa.attempt_id = a.id
            ) as answers
            FROM attempts a
            WHERE a.user_id = $1 AND a.status = 'COMPLETED'
        `, [userId]);

        let totalQuestions = 0;
        let totalCorrect = 0;
        const statsByArea: Record<string, { correct: number; total: number; percentage: number }> = {};
        const statsByDifficulty: Record<string, { correct: number; total: number; percentage: number }> = {};

        for (const attempt of attempts) {
            const answers = attempt.answers || [];
            // O config vem como JSON B, o pg converte pra objeto JS
            const area = attempt.config?.area || 'geral';
            const difficulty = attempt.config?.difficulty || 'mista';

            const questionsInAttempt = answers.length;
            // No PostgreSQL o boolean é retornado como boolean mesmo.
            const correctInAttempt = answers.filter((a: any) => a.is_correct === true).length;

            totalQuestions += questionsInAttempt;
            totalCorrect += correctInAttempt;

            // Agrupar por área
            if (!statsByArea[area]) statsByArea[area] = { correct: 0, total: 0, percentage: 0 };
            statsByArea[area].correct += correctInAttempt;
            statsByArea[area].total += questionsInAttempt;

            // Agrupar por dificuldade
            if (!statsByDifficulty[difficulty]) statsByDifficulty[difficulty] = { correct: 0, total: 0, percentage: 0 };
            statsByDifficulty[difficulty].correct += correctInAttempt;
            statsByDifficulty[difficulty].total += questionsInAttempt;
        }

        // Calcular percentuais
        calculatePercentages(statsByArea);
        calculatePercentages(statsByDifficulty);

        const averagePercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

        return {
            totalAttempts: attempts.length,
            totalQuestions,
            totalCorrect,
            averagePercentage,
            statsByArea,
            statsByDifficulty,
        };

    } catch (error) {
        console.error('Error calculating user stats:', error);
        return emptyStats();
    }
}

function emptyStats(): UserStats {
    return {
        totalAttempts: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        averagePercentage: 0,
        statsByArea: {},
        statsByDifficulty: {},
    };
}

function calculatePercentages(group: Record<string, { correct: number; total: number; percentage: number }>) {
    Object.keys(group).forEach(key => {
        const item = group[key];
        item.percentage = item.total > 0 ? (item.correct / item.total) * 100 : 0;
    });
}

// Calcular projeção (Helper puro, sem banco)
export function calculateProjection(
    correct: number,
    total: number,
    totalQuestions: number
): number {
    if (total === 0) return 0;
    const currentPercent = correct / total;
    return Math.round(currentPercent * totalQuestions);
}

// Gerar recomendações (Helper puro)
export function generateRecommendations(stats: UserStats, cutScores: CutScore[]): string[] {
    const recommendations: string[] = [];

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

    if (stats.averagePercentage < 60) {
        recommendations.push('💡 Sugestão: Foque em conceitos fundamentais antes de simulados complexos.');
    } else if (stats.averagePercentage < 75) {
        recommendations.push('💡 Sugestão: Aumente o volume de simulados para fixar o conteúdo.');
    } else {
        recommendations.push('💡 Sugestão: Mantenha o ritmo e refine detalhes! Você está no caminho certo.');
    }

    return recommendations;
}
