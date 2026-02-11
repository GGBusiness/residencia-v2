'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Target, TrendingUp, Award, Calendar } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type UserStats } from '@/lib/stats-utils';
import { getUserStatsAction } from '@/app/actions/user-actions';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';

export default function MetasPage() {
    const router = useRouter();
    const { user } = useUser();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [cutScores, setCutScores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            loadMetas();
        }
    }, [user?.id]);

    const loadMetas = async () => {
        try {
            if (!user?.id) return;
            const result = await getUserStatsAction(user.id);
            if (result.success && result.data) {
                setStats(result.data);
            }

            const { data: scores } = await supabase
                .from('cut_scores')
                .select('*')
                .order('institution', { ascending: true })
                .order('area', { ascending: true });

            setCutScores(scores || []);
        } catch (error) {
            console.error('Error loading metas:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando metas...</p>
                </div>
            </div>
        );
    }

    const institutions = ['ENARE', 'USP', 'UNICAMP', 'SUS-SP', 'UNIFESP'];

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    🎯 Metas Institucionais
                </h1>
                <p className="text-gray-600">
                    Notas de corte das principais instituições de residência médica
                </p>
            </div>

            {/* Resumo */}
            {stats && stats.totalAttempts > 0 && (
                <Card className="mb-8 bg-gradient-to-r from-primary-600 to-purple-600 text-white">
                    <CardBody className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                                <p className="text-white/80 text-sm mb-1">Sua Média</p>
                                <p className="text-3xl font-bold">{stats.averagePercentage.toFixed(0)}%</p>
                            </div>
                            <div>
                                <p className="text-white/80 text-sm mb-1">Provas Feitas</p>
                                <p className="text-3xl font-bold">{stats.totalAttempts}</p>
                            </div>
                            <div>
                                <p className="text-white/80 text-sm mb-1">Horário de Ouro</p>
                                <p className="text-3xl font-bold capitalize">
                                    {(user as any)?.best_study_time || '-----'}
                                </p>
                            </div>
                            <div>
                                <p className="text-white/80 text-sm mb-1">Meta ENARE</p>
                                <p className="text-3xl font-bold">72%</p>
                            </div>
                            <div>
                                <p className="text-white/80 text-sm mb-1">Diferença</p>
                                <p className="text-3xl font-bold">
                                    {stats.averagePercentage >= 72 ? '+' : ''}
                                    {(stats.averagePercentage - 72).toFixed(0)}%
                                </p>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Metas por Instituição */}
            <div className="space-y-6">
                {institutions.map(institution => {
                    const institutionScores = cutScores.filter(cs => cs.institution === institution);

                    return (
                        <Card key={institution}>
                            <CardBody className="p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                                        <Target className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">{institution}</h2>
                                        <p className="text-sm text-gray-600">
                                            {institutionScores.length} especialidades
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {institutionScores.map((score, idx) => {
                                        const userArea = stats?.statsByArea[score.area.toLowerCase()];
                                        const userPercentage = userArea?.percentage || 0;
                                        const difference = userPercentage - score.percentage;
                                        const isPassing = difference >= 0;

                                        return (
                                            <div
                                                key={idx}
                                                className={`p-4 rounded-lg border-2 ${isPassing
                                                    ? 'bg-green-50 border-green-300'
                                                    : 'bg-orange-50 border-orange-300'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <h3 className="font-bold text-gray-900">{score.area}</h3>
                                                    <Badge variant={isPassing ? 'success' : 'warning'}>
                                                        {isPassing ? '✓' : '⚠'}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Meta:</span>
                                                        <span className="font-bold">{score.percentage.toFixed(0)}%</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600">Acertos:</span>
                                                        <span className="font-bold">{score.passing_score}/{score.total_questions}</span>
                                                    </div>
                                                    {userArea && (
                                                        <>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">Você:</span>
                                                                <span className="font-bold">{userPercentage.toFixed(0)}%</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-600">Diferença:</span>
                                                                <span className={`font-bold ${isPassing ? 'text-green-600' : 'text-orange-600'}`}>
                                                                    {difference > 0 ? '+' : ''}{difference.toFixed(0)}%
                                                                </span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardBody>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
