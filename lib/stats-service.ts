'use server';

import { db, query } from './db';
import { type CutScore, type UserStats } from './stats-utils';

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
            const area = attempt.config?.area || 'geral';
            const difficulty = attempt.config?.difficulty || 'mista';

            const questionsInAttempt = answers.length;
            const correctInAttempt = answers.filter((a: any) => a.is_correct === true).length;

            totalQuestions += questionsInAttempt;
            totalCorrect += correctInAttempt;

            if (!statsByArea[area]) statsByArea[area] = { correct: 0, total: 0, percentage: 0 };
            statsByArea[area].correct += correctInAttempt;
            statsByArea[area].total += questionsInAttempt;

            if (!statsByDifficulty[difficulty]) statsByDifficulty[difficulty] = { correct: 0, total: 0, percentage: 0 };
            statsByDifficulty[difficulty].correct += correctInAttempt;
            statsByDifficulty[difficulty].total += questionsInAttempt;
        }

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
