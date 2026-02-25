'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp, Target, Award, Brain, Calendar } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { generateRecommendations, type UserStats } from '@/lib/stats-utils';
import { getUserStatsAction } from '@/app/actions/user-actions';
import { getCutScoresAction } from '@/app/actions/stats-data-actions';
import { useUser } from '@/hooks/useUser';

interface CutScore {
    institution: string;
    area: string;
    passing_score: number;
    percentage: number;
}

export default function DashboardPage() {
    const router = useRouter();
    const { user } = useUser();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [cutScores, setCutScores] = useState<CutScore[]>([]);
    const [recommendations, setRecommendations] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            loadDashboard();
        }
    }, [user?.id]);

    const loadDashboard = async () => {
        try {
            setLoading(true);

            // Carregar estatísticas
            if (!user?.id) return;
            const result = await getUserStatsAction(user.id);
            let currentUserStats = null;
            if (result.success && result.data) {
                setStats(result.data);
                currentUserStats = result.data;
            }

            // Carregar notas de corte (principais instituições)
            const scoresResult = await getCutScoresAction(['ENARE', 'USP', 'UNICAMP']);
            const scores = scoresResult.data || [];

            if (scores.length > 0) {
                setCutScores(scores as CutScore[]);

                // Gerar recomendações
                if (currentUserStats) {
                    const recs = generateRecommendations(currentUserStats, scores as any);
                    setRecommendations(recs);
                }
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando estatísticas...</p>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
                <Card className="max-w-md">
                    <CardBody className="p-8 text-center">
                        <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Nenhum Dado Disponível</h2>
                        <p className="text-gray-600 mb-6">
                            Você ainda não fez nenhuma prova. Comece agora!
                        </p>
                        <Button variant="primary" onClick={() => router.push('/app/monta-provas')}>
                            Montar Primeira Prova
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    const areaNames: Record<string, string> = {
        'clinica': 'Clínica Médica',
        'cirurgia': 'Cirurgia',
        'go': 'GO',
        'pediatria': 'Pediatria',
        'preventiva': 'Medicina Preventiva',
        'todas': 'Geral',
        'geral': 'Geral',
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6">
                    <Button
                        variant="outline"
                        onClick={() => router.push('/app')}
                        className="mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar
                    </Button>

                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        📊 Dashboard de Estudos
                    </h1>
                    <p className="text-gray-600">
                        Análise completa do seu desempenho
                    </p>
                </div>

                {/* Performance Geral */}
                <Card className="mb-6 bg-gradient-to-r from-primary-600 to-purple-600 text-white">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <Award className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Performance Geral</h2>
                                <p className="text-white/80">Todos os simulados</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-white/80 text-sm mb-1">Média</p>
                                <p className="text-3xl font-bold">{stats.averagePercentage.toFixed(0)}%</p>
                            </div>
                            <div>
                                <p className="text-white/80 text-sm mb-1">Provas</p>
                                <p className="text-3xl font-bold">{stats.totalAttempts}</p>
                            </div>
                            <div>
                                <p className="text-white/80 text-sm mb-1">Questões</p>
                                <p className="text-3xl font-bold">{stats.totalQuestions}</p>
                            </div>
                            <div>
                                <p className="text-white/80 text-sm mb-1">Acertos</p>
                                <p className="text-3xl font-bold">{stats.totalCorrect}</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Performance por Área */}
                    <Card>
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Target className="w-6 h-6 text-primary-600" />
                                <h3 className="text-xl font-bold text-gray-900">Performance por Área</h3>
                            </div>

                            <div className="space-y-4">
                                {Object.entries(stats.statsByArea).map(([areaKey, areaStats]) => {
                                    const areaName = areaNames[areaKey] || areaKey;
                                    const percentage = areaStats.percentage;

                                    let barColor = 'bg-red-500';
                                    let textColor = 'text-red-600';
                                    let icon = '❌';

                                    if (percentage >= 75) {
                                        barColor = 'bg-green-500';
                                        textColor = 'text-green-600';
                                        icon = '✅';
                                    } else if (percentage >= 60) {
                                        barColor = 'bg-yellow-500';
                                        textColor = 'text-yellow-600';
                                        icon = '⚠️';
                                    }

                                    return (
                                        <div key={areaKey}>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-medium text-gray-700">
                                                    {areaName}
                                                </span>
                                                <span className={`text-sm font-bold ${textColor}`}>
                                                    {percentage.toFixed(0)}% {icon}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`${barColor} h-2 rounded-full transition-all duration-500`}
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardBody>
                    </Card>

                    {/* Performance por Dificuldade */}
                    {Object.keys(stats.statsByDifficulty).length > 0 && (
                        <Card>
                            <CardBody className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Brain className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-xl font-bold text-gray-900">Por Dificuldade</h3>
                                </div>

                                <div className="space-y-4">
                                    {Object.entries(stats.statsByDifficulty).map(([diffKey, diffStats]) => {
                                        const percentage = diffStats.percentage;
                                        let barColor = 'bg-purple-500';

                                        if (diffKey === 'Faca na caveira') barColor = 'bg-red-600';
                                        if (diffKey === 'Média') barColor = 'bg-yellow-500';
                                        if (diffKey === 'Fácil') barColor = 'bg-green-500';

                                        return (
                                            <div key={diffKey}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-sm font-medium text-gray-700 capitalize">
                                                        {diffKey}
                                                    </span>
                                                    <span className="text-sm font-bold text-gray-900">
                                                        {percentage.toFixed(0)}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className={`${barColor} h-2 rounded-full transition-all duration-500`}
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardBody>
                        </Card>
                    )}

                    {/* Recomendações */}
                    <Card>
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Brain className="w-6 h-6 text-primary-600" />
                                <h3 className="text-xl font-bold text-gray-900">Sugestões da IA</h3>
                            </div>

                            <div className="space-y-3">
                                {recommendations.map((rec, index) => (
                                    <div
                                        key={index}
                                        className="p-3 bg-primary-50 rounded-lg border-l-4 border-primary-500"
                                    >
                                        <p className="text-sm text-gray-800">{rec}</p>
                                    </div>
                                ))}

                                {recommendations.length === 0 && (
                                    <p className="text-gray-500 text-center py-4">
                                        Faça mais simulados para receber sugestões personalizadas!
                                    </p>
                                )}
                            </div>

                            <div className="mt-6 flex gap-3">
                                <Button
                                    variant="primary"
                                    className="flex-1"
                                    onClick={() => router.push('/app/monta-provas')}
                                >
                                    Montar Nova Prova
                                </Button>
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => router.push('/app/planner')}
                                >
                                    <Calendar className="w-4 h-4 mr-2" />
                                    Planner
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Comparação com Metas (se houver) */}
                {stats.totalAttempts > 0 && (
                    <Card>
                        <CardBody className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <TrendingUp className="w-6 h-6 text-primary-600" />
                                <h3 className="text-xl font-bold text-gray-900">Comparação com Metas</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {['ENARE', 'USP', 'UNICAMP'].map(institution => {
                                    const institutionScores = cutScores.filter(cs => cs.institution === institution);

                                    return institutionScores.map((cutScore, idx) => {
                                        const userAreaStats = stats.statsByArea[cutScore.area.toLowerCase()];
                                        if (!userAreaStats) return null;

                                        const difference = userAreaStats.percentage - cutScore.percentage;
                                        const isPassing = difference >= 0;

                                        return (
                                            <div
                                                key={`${institution}-${idx}`}
                                                className={`p-4 rounded-lg border-2 ${isPassing
                                                    ? 'bg-green-50 border-green-300'
                                                    : 'bg-orange-50 border-orange-300'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <p className="font-bold text-gray-900">{institution}</p>
                                                        <p className="text-sm text-gray-600">{cutScore.area}</p>
                                                    </div>
                                                    <Badge variant={isPassing ? 'success' : 'warning'}>
                                                        {isPassing ? '✓' : '⚠'}
                                                    </Badge>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">Você:</span>
                                                    <span className="font-bold">{userAreaStats.percentage.toFixed(0)}%</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">Meta:</span>
                                                    <span className="font-bold">{cutScore.percentage.toFixed(0)}%</span>
                                                </div>
                                                <div className="flex justify-between text-sm mt-1">
                                                    <span className="text-gray-600">Diferença:</span>
                                                    <span className={`font-bold ${isPassing ? 'text-green-600' : 'text-orange-600'}`}>
                                                        {difference > 0 ? '+' : ''}{difference.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })}
                            </div>
                        </CardBody>
                    </Card>
                )}
            </div>
        </div>
    );
}
