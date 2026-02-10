
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

    if (!stats?.statsByArea) return [];

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
