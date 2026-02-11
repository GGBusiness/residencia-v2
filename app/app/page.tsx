'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Sparkles,
    TrendingUp,
    Clock,
    Target,
    Award,
    Brain,
    Check,
    Plus,
    Calendar
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { Card, CardBody, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { getDashboardDataAction } from '@/app/actions/study-actions';

export default function HomePage() {
    const router = useRouter();
    const { user, firstName } = useUser();
    const [stats, setStats] = useState<any>(null);
    const [weekEvents, setWeekEvents] = useState<any[]>([]);
    const [dailyPlan, setDailyPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);



    // ... inside component

    const loadDashboard = async () => {
        try {
            if (!user?.id) return;

            const result = await getDashboardDataAction(user.id);

            if (result.success && result.data) {
                setStats(result.data.stats);
                setDailyPlan(result.data.dailyPlan);

                // Process week events (client-side logic for display)
                const events = result.data.weekEvents;
                const today = new Date();
                const dayOfWeek = today.getDay();
                const monday = new Date(today);
                monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

                const week = [];
                for (let i = 0; i < 7; i++) {
                    const date = new Date(monday);
                    date.setDate(monday.getDate() + i);
                    const dateStr = date.toISOString().split('T')[0];
                    const dayEvents = events.filter((e: any) => {
                        // Ensure date comp is correct string vs string
                        const eDate = new Date(e.date).toISOString().split('T')[0];
                        return eDate === dateStr;
                    });

                    // Calcular horas do dia
                    const totalMinutes = dayEvents.reduce((sum: number, e: any) => {
                        if (e.start_time && e.end_time) {
                            const [startH, startM] = e.start_time.split(':').map(Number);
                            const [endH, endM] = e.end_time.split(':').map(Number);
                            const duration = (endH * 60 + endM) - (startH * 60 + startM);
                            return sum + duration;
                        }
                        return sum + (e.duration_minutes || 0);
                    }, 0);

                    week.push({
                        date,
                        dateStr,
                        events: dayEvents,
                        totalHours: totalMinutes / 60,
                        completed: dayEvents.filter((e: any) => e.completed).length
                    });
                }
                setWeekEvents(week);
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
                    <p className="text-gray-600">Carregando...</p>
                </div>
            </div>
        );
    }

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayData = weekEvents.find(d => d.dateStr === todayStr);
    const weekTotalHours = weekEvents.reduce((sum, d) => sum + d.totalHours, 0);

    // Meta: 20h/semana = ~3h/dia útil
    const weeklyGoal = 20;
    const dailyGoal = 3;

    // Mock names mapping for charts
    const areaNames: Record<string, string> = {
        'clinica': 'Clínica Médica',
        'cirurgia': 'Cirurgia Geral',
        'go': 'Ginecologia',
        'pediatria': 'Pediatria',
        'preventiva': 'Preventiva',
    };

    return (
        <div className="space-y-8 animate-fade-in">



            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        {firstName ? `Olá, ${firstName}! 👋` : 'Dashboard'}
                    </h1>
                    <p className="text-slate-500 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {today.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => router.push('/app/historico')}
                    >
                        <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                        Ver Relatórios
                    </Button>
                </div>
            </div>

            {/* Hero Card - Daily Plan or Smart Exam */}
            {dailyPlan ? (
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-2xl shadow-indigo-900/20">
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-pulse-slow"></div>
                    <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 rounded-full bg-indigo-500/30 blur-3xl"></div>

                    <div className="relative p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex-1 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-sm font-medium text-white/90">
                                <Target className="w-4 h-4 text-green-300" />
                                <span>Meta de Hoje</span>
                            </div>

                            <div>
                                <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
                                    {dailyPlan.focusArea}
                                </h2>
                                <p className="text-lg text-indigo-100 max-w-xl leading-relaxed">
                                    {dailyPlan.message}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-4 pt-2">
                                <Button
                                    className="bg-white text-indigo-700 hover:bg-indigo-50 border-none font-bold text-base px-8 py-6 h-auto shadow-lg shadow-indigo-900/10 transition-transform hover:scale-105"
                                    onClick={async () => {
                                        // Create attempt from Recommended Config
                                        try {
                                            router.push('/app/monta-provas'); // For now, redirect to wizard. Ideal: auto-start.
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    }}
                                >
                                    <Brain className="w-5 h-5 mr-2" />
                                    Começar Treino ({dailyPlan.recommendedConfig.questionCount}q)
                                </Button>
                            </div>
                        </div>

                        <div className="hidden md:flex relative justify-center items-center">
                            <div className="relative w-48 h-48">
                                <div className="absolute inset-0 bg-white/10 rounded-full animate-ping opacity-20"></div>
                                <div className="absolute inset-4 bg-white/20 rounded-full backdrop-blur-sm flex items-center justify-center border border-white/20">
                                    <Sparkles className="w-20 h-20 text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.5)]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="relative overflow-hidden rounded-3xl bg-indigo-600 text-white shadow-2xl shadow-indigo-900/20">
                    {/* Abstract Background Shapes */}
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 rounded-full bg-white/10 blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 rounded-full bg-indigo-500/30 blur-3xl"></div>

                    <div className="relative p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex-1 space-y-6">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-sm font-medium text-white/90">
                                <Sparkles className="w-4 h-4 text-yellow-300" />
                                <span>Nova Inteligência Artificial</span>
                            </div>

                            <div>
                                <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
                                    Monta Provas <span className="text-indigo-200">2.0</span>
                                </h2>
                                <p className="text-lg text-indigo-100 max-w-xl leading-relaxed">
                                    Nossa IA analisa seu desempenho e cria simulados focados exatamente no que você precisa melhorar para passar na ENARE, USP e SUS-SP.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-4 pt-2">
                                <Button
                                    className="bg-white text-indigo-700 hover:bg-indigo-50 border-none font-bold text-base px-8 py-6 h-auto shadow-lg shadow-indigo-900/10 transition-transform hover:scale-105"
                                    onClick={() => router.push('/app/monta-provas')}
                                >
                                    <Brain className="w-5 h-5 mr-2" />
                                    Criar Prova Inteligente
                                </Button>

                                <div className="flex items-center gap-[-8px] pl-2 hidden sm:flex">
                                    <div className="w-10 h-10 rounded-full border-2 border-indigo-600 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 z-30" title="ENARE">EN</div>
                                    <div className="w-10 h-10 rounded-full border-2 border-indigo-600 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 -ml-3 z-20" title="USP">USP</div>
                                    <div className="w-10 h-10 rounded-full border-2 border-indigo-600 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 -ml-3 z-10" title="SUS">SUS</div>
                                    <div className="ml-2 text-sm text-indigo-200 font-medium">+15 Inst.</div>
                                </div>
                            </div>
                        </div>

                        <div className="hidden md:block relative">
                            <div className="w-64 h-64 bg-indigo-500/30 rounded-full flex items-center justify-center relative backdrop-blur-sm border border-white/10">
                                <Target className="w-32 h-32 text-indigo-200 opacity-80" />
                                {/* Floating badges */}
                                <div className="absolute top-0 right-0 bg-white text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-bounce [animation-delay:-0.5s]">
                                    +50.000 Questões
                                </div>
                                <div className="absolute bottom-10 -left-4 bg-white text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-bounce">
                                    Alto Rendimento
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card hover>
                    <CardBody className="flex items-center gap-4 p-6">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Clock className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Estudo Hoje</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-2xl font-bold text-slate-900">
                                    {todayData ? todayData.totalHours.toFixed(1) : '0'}h
                                </h3>
                                <span className="text-xs font-medium text-slate-400">/ {dailyGoal}h meta</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                                <div
                                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min((todayData?.totalHours || 0) / dailyGoal * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card hover>
                    <CardBody className="flex items-center gap-4 p-6">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Estudo Semanal</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-2xl font-bold text-slate-900">
                                    {weekTotalHours.toFixed(1)}h
                                </h3>
                                <span className="text-xs font-medium text-slate-400">/ {weeklyGoal}h meta</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                                <div
                                    className="bg-purple-500 h-1.5 rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min(weekTotalHours / weeklyGoal * 100, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <Card hover>
                    <CardBody className="flex items-center gap-4 p-6">
                        <div className="p-3 bg-teal-50 text-teal-600 rounded-xl">
                            <Award className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Média Geral</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-2xl font-bold text-slate-900">
                                    {stats?.averagePercentage?.toFixed(0) || '-'}%
                                </h3>
                                <span className="text-xs font-medium text-green-600 flex items-center">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    Subindo
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                Baseado em {stats?.totalAttempts || 0} avaliações
                            </p>
                        </div>
                    </CardBody>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Weekly Calendar */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-slate-900">Sessões da Semana</h2>
                            <Button variant="ghost" size="sm" onClick={() => router.push('/app/planner')}>
                                Ver Planner Completo
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                            {weekEvents.map(({ date, dateStr, events, totalHours, completed }) => {
                                const dayName = dayNames[date.getDay()];
                                const dayNumber = date.getDate();
                                const isToday = dateStr === todayStr;
                                const hasActivity = totalHours > 0;

                                return (
                                    <div
                                        key={dateStr}
                                        className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${isToday
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
                                            : hasActivity
                                                ? 'bg-white border-slate-200 hover:border-indigo-300'
                                                : 'bg-slate-50 border-transparent opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        <span className={`text-xs font-medium mb-1 ${isToday ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {dayName}
                                        </span>
                                        <span className={`text-lg font-bold mb-2 ${isToday ? 'text-white' : 'text-slate-700'}`}>
                                            {dayNumber}
                                        </span>

                                        {hasActivity ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="text-[10px] font-bold">
                                                    {totalHours.toFixed(1)}h
                                                </div>
                                                <div className={`w-1 h-1 rounded-full ${isToday ? 'bg-white' : 'bg-indigo-500'}`}></div>
                                            </div>
                                        ) : (
                                            <div className="h-6 w-full flex items-center justify-center">
                                                <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Today's Events List */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Atividades de Hoje</CardTitle>
                            <Button size="sm" onClick={() => router.push('/app/planner')}>
                                <Plus className="w-4 h-4 mr-1" /> Adicionar
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {todayData?.events && todayData.events.length > 0 ? (
                                <div className="space-y-3">
                                    {todayData.events.map((event: any) => (
                                        <div key={event.id} className="group flex items-center p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${event.completed ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                                {event.completed ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className={`font-semibold text-slate-900 ${event.completed && 'line-through text-slate-400'}`}>
                                                    {event.title}
                                                </h4>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                    {event.start_time && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" /> {event.start_time} - {event.end_time}
                                                        </span>
                                                    )}
                                                    {event.area && (
                                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                                            {event.area}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="w-1 h-1 rounded-full bg-slate-400 box-content p-0.5 border-l-2 border-r-2 border-transparent"></div>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-400">
                                    <Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p>Nenhuma atividade planejada para hoje.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Stats & Insights */}
                <div className="space-y-6">
                    {/* Performance Bars */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Desempenho por Área</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                {stats?.statsByArea && Object.keys(stats.statsByArea).length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={Object.entries(stats.statsByArea).map(([area, areaStats]: [string, any]) => ({
                                                name: areaNames[area] || area,
                                                score: Math.round(areaStats.percentage),
                                                fill: areaStats.percentage >= 75 ? '#22c55e' : areaStats.percentage >= 60 ? '#eab308' : '#ef4444'
                                            }))}
                                            layout="vertical"
                                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                            <XAxis type="number" domain={[0, 100]} hide />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                width={100}
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                interval={0}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f1f5f9' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar
                                                dataKey="score"
                                                radius={[0, 4, 4, 0]}
                                                barSize={24}
                                            >
                                                {
                                                    Object.entries(stats.statsByArea).map(([area, areaStats]: [string, any], index) => (
                                                        <Cell key={`cell-${index}`} fill={areaStats.percentage >= 75 ? '#22c55e' : areaStats.percentage >= 60 ? '#eab308' : '#ef4444'} />
                                                    ))
                                                }
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                                        <TrendingUp className="w-10 h-10 mb-3 opacity-20" />
                                        <p>Faça simulados para ver sua performance.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Dica / Insight */}
                    <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                                <Brain className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg mb-1">Dica do Tutor IA</h3>
                                <p className="text-indigo-100 text-sm leading-relaxed">
                                    {todayData && todayData.totalHours >= dailyGoal
                                        ? "Excelente ritmo! Que tal revisar 'Imunizações' na Pediatria hoje? É um tema recorrente na USP."
                                        : "Tente manter o foco em sessões de 50min (Pomodoro). Isso ajuda na retenção de memória."
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
