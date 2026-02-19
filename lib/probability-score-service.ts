'use server';

import { query } from './db';
import { getUserStats } from './stats-service';
import { getStudyTimeSummary } from './study-time-service';

/**
 * Score de Probabilidade — "X% de chance de atingir sua meta"
 * 
 * Fatores:
 * 1. Desempenho (40%) — Média de acertos vs nota de corte da instituição-alvo
 * 2. Constância (25%) — Horas estudadas vs meta semanal
 * 3. Cobertura (20%) — Quantas áreas o aluno já praticou
 * 4. Tendência (15%) — Performance está melhorando ou piorando
 */

interface ProbabilityResult {
    score: number;             // 0-100
    label: string;             // "Excelente", "Boa", "Mediana", "Precisa melhorar"
    color: string;             // CSS color class
    factors: {
        performance: { value: number; label: string };
        consistency: { value: number; label: string };
        coverage: { value: number; label: string };
        trend: { value: number; label: string };
    };
    message: string;           // Personalized motivational message
    daysUntilExam: number | null;
}

export async function calculateProbabilityScore(userId: string): Promise<ProbabilityResult> {
    try {
        // 1. Get user profile
        const { rows: profiles } = await query(
            'SELECT * FROM user_profiles WHERE user_id = $1', [userId]
        );
        const profile = profiles[0];
        if (!profile) {
            return defaultResult('Complete o onboarding para ver seu score.');
        }

        // 2. Get user stats
        const stats = await getUserStats(userId);

        // 3. Get study time
        const studyTime = await getStudyTimeSummary(userId);

        // 4. Get cut score for target institution
        const { rows: cutScores } = await query(
            `SELECT AVG(percentage) as avg_percentage 
             FROM cut_scores 
             WHERE institution = $1`,
            [profile.target_institution]
        );
        const targetPercentage = Number(cutScores[0]?.avg_percentage || 70);

        // 5. Get recent performance trend (last 5 vs previous 5 attempts)
        const { rows: recentAttempts } = await query(
            `SELECT percentage, completed_at FROM attempts 
             WHERE user_id = $1 AND status = 'COMPLETED' AND percentage IS NOT NULL
             ORDER BY completed_at DESC LIMIT 10`,
            [userId]
        );

        // ═══════════ FACTOR 1: Performance (40%) ═══════════
        let performanceFactor = 0;
        let perfLabel = 'Sem dados';
        if (stats.totalQuestions > 0) {
            const ratio = stats.averagePercentage / targetPercentage;
            performanceFactor = Math.min(100, Math.round(ratio * 100));
            if (performanceFactor >= 100) perfLabel = `${stats.averagePercentage.toFixed(0)}% — Acima da meta!`;
            else if (performanceFactor >= 80) perfLabel = `${stats.averagePercentage.toFixed(0)}% — Quase lá`;
            else if (performanceFactor >= 50) perfLabel = `${stats.averagePercentage.toFixed(0)}% — Em progresso`;
            else perfLabel = `${stats.averagePercentage.toFixed(0)}% — Precisa reforçar`;
        }

        // ═══════════ FACTOR 2: Consistency (25%) ═══════════
        let consistencyFactor = 0;
        let consLabel = 'Sem dados';
        const weeklyGoalHours = profile.weekly_hours || 20;
        const weekStudyHours = (studyTime.week.seconds || 0) / 3600;
        if (weeklyGoalHours > 0) {
            consistencyFactor = Math.min(100, Math.round((weekStudyHours / weeklyGoalHours) * 100));
            if (consistencyFactor >= 90) consLabel = `${weekStudyHours.toFixed(1)}h — Meta atingida!`;
            else if (consistencyFactor >= 50) consLabel = `${weekStudyHours.toFixed(1)}h de ${weeklyGoalHours}h`;
            else consLabel = `${weekStudyHours.toFixed(1)}h — Aumente o ritmo`;
        }

        // ═══════════ FACTOR 3: Coverage (20%) ═══════════
        const allAreas = ['Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Ginecologia e Obstetrícia', 'Medicina Preventiva'];
        const practicedAreas = Object.keys(stats.statsByArea).length;
        const coverageFactor = Math.min(100, Math.round((practicedAreas / allAreas.length) * 100));
        const covLabel = `${practicedAreas} de ${allAreas.length} áreas`;

        // ═══════════ FACTOR 4: Trend (15%) ═══════════
        let trendFactor = 50; // Neutral
        let trendLabel = 'Sem dados suficientes';
        if (recentAttempts.length >= 4) {
            const half = Math.floor(recentAttempts.length / 2);
            const recentAvg = recentAttempts.slice(0, half).reduce((s: number, a: any) => s + Number(a.percentage), 0) / half;
            const olderAvg = recentAttempts.slice(half).reduce((s: number, a: any) => s + Number(a.percentage), 0) / (recentAttempts.length - half);
            const diff = recentAvg - olderAvg;

            if (diff > 5) { trendFactor = 90; trendLabel = `↑ Melhorando (+${diff.toFixed(0)}%)`; }
            else if (diff > 0) { trendFactor = 70; trendLabel = `↗ Leve melhora (+${diff.toFixed(0)}%)`; }
            else if (diff > -5) { trendFactor = 40; trendLabel = `→ Estável (${diff.toFixed(0)}%)`; }
            else { trendFactor = 20; trendLabel = `↓ Caindo (${diff.toFixed(0)}%)`; }
        }

        // ═══════════ WEIGHTED SCORE ═══════════
        const rawScore = (
            performanceFactor * 0.40 +
            consistencyFactor * 0.25 +
            coverageFactor * 0.20 +
            trendFactor * 0.15
        );
        const score = Math.round(Math.max(0, Math.min(100, rawScore)));

        // Days until exam
        let daysUntilExam: number | null = null;
        switch (profile.exam_timeframe) {
            case 'menos_3_meses': daysUntilExam = 60; break;
            case '3_6_meses': daysUntilExam = 135; break;
            case '6_12_meses': daysUntilExam = 270; break;
            case 'mais_1_ano': daysUntilExam = 400; break;
        }

        // Label and color
        let label: string, color: string, message: string;
        if (score >= 80) {
            label = 'Excelente';
            color = 'text-emerald-500';
            message = 'Você está no caminho certo! Continue assim e a aprovação virá naturalmente. 🏆';
        } else if (score >= 60) {
            label = 'Boa';
            color = 'text-blue-500';
            message = 'Bom progresso! Mantenha a constância e foque nas áreas mais fracas. 💪';
        } else if (score >= 40) {
            label = 'Mediana';
            color = 'text-amber-500';
            message = 'Há espaço para melhorar. Aumente as horas de estudo e pratique mais questões. 📚';
        } else {
            label = 'Precisa melhorar';
            color = 'text-red-500';
            message = 'Não desanime! Comece com sessões curtas e vá aumentando o ritmo gradativamente. 🔥';
        }

        // Bonus: if they have no data at all
        if (stats.totalQuestions === 0) {
            return defaultResult('Faça sua primeira prova para calcular seu Score! 🎯');
        }

        return {
            score,
            label,
            color,
            factors: {
                performance: { value: performanceFactor, label: perfLabel },
                consistency: { value: consistencyFactor, label: consLabel },
                coverage: { value: coverageFactor, label: covLabel },
                trend: { value: trendFactor, label: trendLabel },
            },
            message,
            daysUntilExam,
        };

    } catch (error) {
        console.error('❌ [ProbabilityScore] Error:', error);
        return defaultResult('Erro ao calcular score.');
    }
}

function defaultResult(message: string): ProbabilityResult {
    return {
        score: 0,
        label: 'Sem dados',
        color: 'text-slate-400',
        factors: {
            performance: { value: 0, label: 'Sem dados' },
            consistency: { value: 0, label: 'Sem dados' },
            coverage: { value: 0, label: 'Sem dados' },
            trend: { value: 0, label: 'Sem dados' },
        },
        message,
        daysUntilExam: null,
    };
}
