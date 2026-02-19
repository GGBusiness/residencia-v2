'use client';

import { useEffect, useState } from 'react';
import { Target, TrendingUp, Award, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { type UserStats } from '@/lib/stats-utils';
import { getUserStatsAction } from '@/app/actions/user-actions';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';

export function GoalsTab() {
    const { user, profile, goals, loading: userLoading } = useUser();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [cutScores, setCutScores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userLoading) return;
        if (user?.id) {
            loadMetas();
        } else {
            setLoading(false);
        }
    }, [user?.id, userLoading]);

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
            <div className="flex items-center justify-center p-12">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando metas...</p>
                </div>
            </div>
        );
    }

    // Get unique institutions from cut scores or profile
    const institutions = Array.from(new Set(cutScores.map(cs => cs.institution)));
    // Prioritize profile target institution
    if (profile?.target_institution && institutions.includes(profile.target_institution)) {
        institutions.sort((a, b) => a === profile.target_institution ? -1 : b === profile.target_institution ? 1 : 0);
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Intro */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    🎯 Metas & Desempenho
                </h2>
                <p className="text-gray-600">
                    Acompanhe seu progresso em relação às notas de corte das residências.
                </p>
            </div>

            {/* Resumo Personalizado - Hero Card */}
            <Card className="bg-gradient-to-r from-primary-600 to-purple-600 text-white shadow-lg border-0 transform transition-all hover:scale-[1.01]">
                <CardBody className="p-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                            <p className="text-white/80 text-sm font-medium uppercase tracking-wide">Instituição Alvo</p>
                            <p className="text-2xl font-bold truncate">
                                {profile?.target_institution || 'Definir'}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-white/80 text-sm font-medium uppercase tracking-wide">Especialidade</p>
                            <p className="text-xl font-bold truncate">
                                {profile?.target_specialty || 'Definir'}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-white/80 text-sm font-medium uppercase tracking-wide">Meta Semanal</p>
                            <div className="flex items-baseline gap-1">
                                <p className="text-3xl font-bold">{goals?.weekly_hours_goal || 0}</p>
                                <span className="text-sm text-white/80">horas</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-white/80 text-sm font-medium uppercase tracking-wide">Média Geral</p>
                            <div className="flex items-baseline gap-1">
                                <p className="text-3xl font-bold">{stats?.averagePercentage?.toFixed(0) || 0}</p>
                                <span className="text-sm text-white/80">%</span>
                            </div>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Dica Personalizada */}
            {profile?.theoretical_base === 'fraca' && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                    <div className="bg-orange-100 p-2 rounded-lg shrink-0">
                        <TrendingUp className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-orange-900">Foco em Base Teórica</h3>
                        <p className="text-orange-800 text-sm mt-1">
                            Como sua base é inicial, o sistema priorizará questões comentadas e aulas teóricas no seu planner para fortalecer seus fundamentos.
                        </p>
                    </div>
                </div>
            )}

            {/* Metas por Instituição */}
            <div className="grid gap-6">
                {institutions.map(institution => {
                    const institutionScores = cutScores.filter(cs => cs.institution === institution);
                    if (institutionScores.length === 0) return null;

                    return (
                        <Card key={institution} className="overflow-hidden border-gray-200 shadow-sm hover:shadow-md transition-all">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                                        <Target className="w-5 h-5 text-primary-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{institution}</h3>
                                        <p className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200 inline-block mt-1">
                                            {institutionScores.length} especialidades rastreadas
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <CardBody className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {institutionScores.map((score, idx) => {
                                        const userArea = stats?.statsByArea?.[score.area.toLowerCase()] || stats?.statsByArea?.[score.area];
                                        const userPercentage = userArea?.percentage || 0;
                                        const difference = userPercentage - score.percentage;
                                        const isPassing = difference >= 0;

                                        return (
                                            <div
                                                key={idx}
                                                className={`relative p-4 rounded-xl border-2 transition-all ${isPassing
                                                    ? 'bg-green-50/50 border-green-200 hover:border-green-300'
                                                    : 'bg-red-50/50 border-red-200 hover:border-red-300'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <h4 className="font-bold text-gray-900 line-clamp-1" title={score.area}>{score.area}</h4>
                                                    {isPassing ? (
                                                        <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                                                    ) : (
                                                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                                    )}
                                                </div>

                                                <div className="space-y-3">
                                                    {/* Progress Bars */}
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs text-gray-600">
                                                            <span>Meta da Banca</span>
                                                            <span className="font-semibold">{score.percentage.toFixed(0)}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                            <div className="h-full bg-gray-400 rounded-full" style={{ width: `${Math.min(100, score.percentage)}%` }} />
                                                        </div>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-xs text-gray-600">
                                                            <span>Seu Desempenho</span>
                                                            <span className={`font-bold ${isPassing ? 'text-green-700' : 'text-red-600'}`}>
                                                                {userPercentage.toFixed(0)}%
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${isPassing ? 'bg-green-500' : 'bg-red-500'}`}
                                                                style={{ width: `${Math.min(100, userPercentage)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-3 pt-3 border-t border-gray-200/50 flex justify-between items-center text-sm">
                                                    <span className="text-gray-500">Gap</span>
                                                    <Badge variant={isPassing ? 'success' : 'destructive'} className="px-2 py-0.5 font-mono">
                                                        {difference > 0 ? '+' : ''}{difference.toFixed(0)}%
                                                    </Badge>
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
