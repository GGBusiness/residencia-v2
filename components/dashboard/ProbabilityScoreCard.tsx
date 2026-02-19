'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Zap, BookOpen, BarChart3, ArrowUpRight } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getProbabilityScoreAction } from '@/app/actions/probability-actions';

interface Props {
    userId: string;
}

export function ProbabilityScoreCard({ userId }: Props) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [animatedScore, setAnimatedScore] = useState(0);

    useEffect(() => {
        if (userId) {
            getProbabilityScoreAction(userId).then(res => {
                if (res.success) setData(res.data);
                setLoading(false);
            });
        }
    }, [userId]);

    // Animate score number
    useEffect(() => {
        if (!data) return;
        const target = data.score;
        const duration = 1500;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                setAnimatedScore(target);
                clearInterval(timer);
            } else {
                setAnimatedScore(Math.round(current));
            }
        }, duration / steps);
        return () => clearInterval(timer);
    }, [data]);

    if (loading) {
        return (
            <Card>
                <CardBody className="p-6">
                    <div className="animate-pulse flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-slate-200"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                        </div>
                    </div>
                </CardBody>
            </Card>
        );
    }

    if (!data || data.score === 0) {
        return (
            <Card className="border-dashed border-2 border-slate-200">
                <CardBody className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                        <Zap className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">{data?.message || 'Faça sua primeira prova para ver seu Score!'}</p>
                </CardBody>
            </Card>
        );
    }

    const circumference = 2 * Math.PI * 40;
    const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

    const factorIcons = {
        performance: TrendingUp,
        consistency: Zap,
        coverage: BookOpen,
        trend: BarChart3,
    };
    const factorNames: Record<string, string> = {
        performance: 'Desempenho',
        consistency: 'Constância',
        coverage: 'Cobertura',
        trend: 'Tendência',
    };

    const getScoreGradient = (score: number) => {
        if (score >= 80) return 'from-emerald-400 to-emerald-600';
        if (score >= 60) return 'from-blue-400 to-blue-600';
        if (score >= 40) return 'from-amber-400 to-amber-600';
        return 'from-red-400 to-red-600';
    };

    const getStrokeColor = (score: number) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#3b82f6';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <Card className="overflow-hidden">
            <CardBody className="p-0">
                {/* Header with score */}
                <div className={cn(
                    "bg-gradient-to-r p-6 text-white",
                    getScoreGradient(data.score)
                )}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            {/* Circular Progress */}
                            <div className="relative w-24 h-24 shrink-0">
                                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                                    <circle
                                        cx="50" cy="50" r="40"
                                        stroke="rgba(255,255,255,0.2)"
                                        strokeWidth="8"
                                        fill="none"
                                    />
                                    <circle
                                        cx="50" cy="50" r="40"
                                        stroke="white"
                                        strokeWidth="8"
                                        fill="none"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={strokeDashoffset}
                                        strokeLinecap="round"
                                        className="transition-all duration-1000 ease-out"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl font-black">{animatedScore}%</span>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-bold">Score de Probabilidade</h3>
                                    <ArrowUpRight className="w-4 h-4 opacity-70" />
                                </div>
                                <p className="text-white/80 text-sm font-medium">{data.label}</p>
                                <p className="text-white/70 text-xs mt-1 max-w-xs">{data.message}</p>
                            </div>
                        </div>

                        {data.daysUntilExam && (
                            <div className="hidden md:block text-right">
                                <p className="text-white/70 text-xs">Dias para a prova</p>
                                <p className="text-3xl font-black">~{data.daysUntilExam}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Factors Breakdown */}
                <div className="p-5">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Fatores</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(data.factors).map(([key, factor]: [string, any]) => {
                            const Icon = factorIcons[key as keyof typeof factorIcons];
                            return (
                                <div key={key} className="bg-slate-50 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Icon className="w-4 h-4 text-slate-500" />
                                        <span className="text-xs font-semibold text-slate-600">{factorNames[key]}</span>
                                    </div>
                                    <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden mb-1.5">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000 ease-out"
                                            style={{
                                                width: `${factor.value}%`,
                                                backgroundColor: getStrokeColor(factor.value),
                                            }}
                                        ></div>
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate" title={factor.label}>
                                        {factor.label}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}
