'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Plus, Calendar as CalendarIcon, Check, X, Target, Clock, Loader2, AlertTriangle, RefreshCw, BarChart2 } from 'lucide-react';
import { GoalsTab } from '@/components/planner/GoalsTab';
import { PlannerStats } from '@/components/planner/PlannerStats';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getStudyEventsAction, createStudyEventAction, toggleEventCompleteAction, deleteStudyEventAction } from '@/app/actions/planner-data-actions';
import { useUser } from '@/hooks/useUser';
import { generateScheduleAction } from '@/app/actions/planner-actions';
import { scheduleSpacedReviewsAction } from '@/app/actions/spaced-review-actions';
import { ConfirmationModal } from '@/components/ui/modal';

interface StudyEvent {
    id: string;
    title: string;
    description?: string;
    event_type: 'study' | 'exam' | 'review';
    area?: string;
    date: string;
    start_time?: string;
    end_time?: string;
    duration_minutes?: number;
    completed: boolean;
}

export default function PlannerPage() {
    const router = useRouter();
    const { firstName, user, profile, goals } = useUser();
    const [events, setEvents] = useState<StudyEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
    const [autoGenerating, setAutoGenerating] = useState(false);
    const [activeTab, setActiveTab] = useState<'schedule' | 'goals'>('schedule');
    const [missedCount, setMissedCount] = useState(0);
    const [catchUpLoading, setCatchUpLoading] = useState(false);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'confirm' | 'alert';
        onConfirm?: () => void;
        variant?: 'primary' | 'danger';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'alert'
    });

    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    const showConfirm = (title: string, message: string, onConfirm: () => void, variant: 'primary' | 'danger' = 'primary') => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            type: 'confirm',
            onConfirm: async () => {
                await onConfirm();
                closeModal();
            },
            variant
        });
    };

    const showAlert = (title: string, message: string) => {
        setModalConfig({
            isOpen: true,
            title,
            message,
            type: 'alert',
            onConfirm: closeModal
        });
    };

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        event_type: 'study' as 'study' | 'exam' | 'review',
        area: '',
        date: new Date().toLocaleDateString('en-CA'),
        start_time: '09:00',
        end_time: '12:00',
    });

    // Load events and auto-generate if empty
    useEffect(() => {
        if (user?.id && profile) {
            loadEventsAndAutoGenerate();
        }
    }, [user?.id, profile]);

    const loadEventsAndAutoGenerate = async () => {
        if (!user?.id) return;
        try {
            setLoading(true);
            const result = await getStudyEventsAction(user.id);
            const loadedEvents = (result.data || []) as StudyEvent[];

            // Detect missed sessions (overdue + not completed)
            const today = new Date().toLocaleDateString('en-CA');
            const overdueEvents = loadedEvents.filter(e => {
                const eDate = typeof e.date === 'string' ? e.date.split('T')[0] : new Date(e.date).toLocaleDateString('en-CA');
                return eDate < today && !e.completed;
            });
            setMissedCount(overdueEvents.length);

            // Auto-generate if no future events exist
            const futureEvents = loadedEvents.filter(e => e.date >= today);

            if (futureEvents.length === 0 && profile) {
                console.log('📅 [Planner] No future events found — auto-generating...');
                setAutoGenerating(true);
                try {
                    const genResult = await generateScheduleAction(user.id, today);
                    if (genResult.success) {
                        console.log('✅ [Planner] Auto-generated schedule successfully');
                        // Reload events
                        const reloadResult = await getStudyEventsAction(user.id);
                        setEvents((reloadResult.data || []) as StudyEvent[]);
                    } else {
                        console.error('❌ [Planner] Auto-generate failed:', genResult.error);
                        setEvents(loadedEvents);
                    }
                } catch (genError) {
                    console.error('❌ [Planner] Auto-generate error:', genError);
                    setEvents(loadedEvents);
                } finally {
                    setAutoGenerating(false);
                }
            } else {
                setEvents(loadedEvents);
            }
        } catch (error) {
            console.error('Error loading events:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEvent = async () => {
        try {
            if (!user?.id) return;
            const result = await createStudyEventAction(user.id, formData);
            if (!result.success) throw new Error(result.error);

            await loadEventsAndAutoGenerate();
            setShowForm(false);
            setFormData({
                title: '',
                description: '',
                event_type: 'study',
                area: '',
                date: new Date().toLocaleDateString('en-CA'),
                start_time: '09:00',
                end_time: '12:00',
            });
        } catch (error) {
            console.error('Error creating event:', error);
            showAlert('Erro', 'Erro ao criar sessão.');
        }
    };

    const toggleComplete = async (eventId: string, currentStatus: boolean) => {
        try {
            const result = await toggleEventCompleteAction(eventId, !currentStatus);
            if (!result.success) throw new Error(result.error);

            // Schedule spaced reviews when marking a STUDY event as completed
            if (!currentStatus && user?.id) {
                const event = events.find(e => e.id === eventId);
                if (event && event.event_type === 'study' && event.area) {
                    const eventDate = typeof event.date === 'string'
                        ? event.date.split('T')[0]
                        : new Date(event.date).toLocaleDateString('en-CA');
                    scheduleSpacedReviewsAction(user.id, event.area, eventDate, 'study', event.title)
                        .then(r => r.count && console.log(`🔁 ${r.count} revisões agendadas para ${event.area}`))
                        .catch(console.error);
                }
            }

            await loadEventsAndAutoGenerate();
        } catch (error) {
            console.error('Error updating event:', error);
        }
    };

    const deleteEvent = (eventId: string) => {
        showConfirm(
            'Remover Sessão',
            'Deseja realmente remover esta sessão de estudo?',
            async () => {
                try {
                    const result = await deleteStudyEventAction(eventId);
                    if (!result.success) throw new Error(result.error);
                    await loadEventsAndAutoGenerate();
                } catch (error) {
                    console.error('Error deleting event:', error);
                    showAlert('Erro', 'Erro ao remover sessão.');
                }
            },
            'danger'
        );
    };

    const getWeekEvents = () => {
        const today = new Date();
        const week = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toLocaleDateString('en-CA');
            const dayEvents = events.filter(e => {
                const eDate = typeof e.date === 'string' ? e.date.split('T')[0] : new Date(e.date).toLocaleDateString('en-CA');
                return eDate === dateStr;
            });
            week.push({ date, dateStr, events: dayEvents });
        }
        return week;
    };

    const getMonthDays = () => {
        const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

        const startDate = new Date(start);
        startDate.setDate(start.getDate() - start.getDay());

        const days = [];
        let current = new Date(startDate);

        for (let i = 0; i < 42; i++) {
            const dateStr = current.toLocaleDateString('en-CA');
            days.push({
                date: new Date(current),
                dateStr,
                isCurrentMonth: current.getMonth() === selectedDate.getMonth(),
                isToday: dateStr === new Date().toLocaleDateString('en-CA'),
                events: events.filter(e => {
                    const eDate = typeof e.date === 'string' ? e.date.split('T')[0] : new Date(e.date).toLocaleDateString('en-CA');
                    return eDate === dateStr;
                })
            });
            current.setDate(current.getDate() + 1);
        }
        return days;
    };

    const changeMonth = (offset: number) => {
        setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1));
    };

    const eventTypeIcons = {
        study: '📚',
        exam: '🎯',
        review: '🔄',
    };

    const todayStr = new Date().toLocaleDateString('en-CA');

    // Loading state
    if (loading || autoGenerating) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">
                        {autoGenerating
                            ? 'Criando seu cronograma personalizado...'
                            : 'Carregando planner...'}
                    </p>
                    {autoGenerating && (
                        <p className="text-sm text-gray-400 mt-2">
                            Baseado no seu perfil e preferências
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Explicitly calculate these before return
    const weekEvents = getWeekEvents();
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                {firstName ? `Planner de ${firstName}` : '📅 Planner de Estudos'}
                            </h1>
                            <p className="text-gray-600">
                                Seu centro de comando para aprovação.
                            </p>
                        </div>

                        {/* Tab Switcher */}
                        <div className="flex bg-gray-100 p-1 rounded-xl self-start md:self-auto">
                            <button
                                onClick={() => setActiveTab('schedule')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'schedule'
                                    ? 'bg-white text-primary-700 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                    }`}
                            >
                                <CalendarIcon className="w-4 h-4" />
                                Cronograma
                            </button>
                            <button
                                onClick={() => setActiveTab('goals')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'goals'
                                    ? 'bg-white text-primary-700 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                    }`}
                            >
                                <Target className="w-4 h-4" />
                                Metas & Desempenho
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="animate-in fade-in duration-500">
                    {activeTab === 'goals' ? (
                        <GoalsTab />
                    ) : (
                        <div className="space-y-6">

                            {/* Stats */}
                            <PlannerStats events={events} goals={goals} />

                            {/* Planner Actions Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <CalendarIcon className="w-5 h-5 text-primary-600" />
                                        Agenda Semanal
                                    </h2>
                                    <p className="text-sm text-gray-500">
                                        Organize seus estudos e revisões.
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowForm(true)}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Nova Sessão
                                    </Button>

                                    {/* Catch Up Button */}
                                    <Button
                                        variant="primary"
                                        onClick={async () => {
                                            if (!user?.id) return;
                                            setCatchUpLoading(true);
                                            try {
                                                const today = new Date().toLocaleDateString('en-CA');
                                                const result = await generateScheduleAction(user.id, today);
                                                if (result.success) {
                                                    await loadEventsAndAutoGenerate();
                                                }
                                            } catch (e) {
                                                console.error('Catch-up error:', e);
                                            } finally {
                                                setCatchUpLoading(false);
                                            }
                                        }}
                                        disabled={catchUpLoading}
                                        className="shrink-0"
                                    >
                                        {catchUpLoading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <RefreshCw className="w-4 h-4 mr-2" />
                                        )}
                                        Recalcular
                                    </Button>
                                </div>
                            </div>

                            {/* Form Modal */}
                            {showForm && (
                                <Card className="mb-6">
                                    <CardBody className="p-6">
                                        <h3 className="text-xl font-bold text-gray-900 mb-4">Nova Sessão de Estudo</h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Título *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={formData.title}
                                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                    placeholder="Ex: Revisão de Cirurgia"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Área
                                                </label>
                                                <select
                                                    value={formData.area}
                                                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                >
                                                    <option value="">Selecione...</option>
                                                    <option value="Cirurgia Geral">Cirurgia Geral</option>
                                                    <option value="Clínica Médica">Clínica Médica</option>
                                                    <option value="Ginecologia e Obstetrícia">Ginecologia e Obstetrícia</option>
                                                    <option value="Pediatria">Pediatria</option>
                                                    <option value="Medicina Preventiva">Medicina Preventiva</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Tipo *
                                                </label>
                                                <select
                                                    value={formData.event_type}
                                                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value as any })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                >
                                                    <option value="study">📚 Estudo</option>
                                                    <option value="exam">🎯 Simulado</option>
                                                    <option value="review">🔄 Revisão</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Data *
                                                </label>
                                                <input
                                                    type="date"
                                                    value={formData.date}
                                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Início
                                                </label>
                                                <input
                                                    type="time"
                                                    value={formData.start_time}
                                                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Fim
                                                </label>
                                                <input
                                                    type="time"
                                                    value={formData.end_time}
                                                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Descrição
                                            </label>
                                            <textarea
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                                rows={3}
                                                placeholder="Anotações sobre esta sessão..."
                                            />
                                        </div>

                                        <div className="flex gap-3">
                                            <Button
                                                variant="outline"
                                                onClick={() => setShowForm(false)}
                                                className="flex-1"
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={handleCreateEvent}
                                                disabled={!formData.title || !formData.date}
                                                className="flex-1"
                                            >
                                                Salvar
                                            </Button>
                                        </div>
                                    </CardBody>
                                </Card>
                            )}

                            {/* Weekly View Content */}
                            <Card>
                                <CardBody className="p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold text-gray-900">
                                            {viewMode === 'week' ? 'Próximos 7 Dias' : 'Calendário Mensal'}
                                        </h3>
                                        {viewMode === 'week' && (
                                            <p className="text-sm text-gray-500">
                                                Hoje: {new Date().toLocaleDateString('pt-BR')}
                                            </p>
                                        )}
                                    </div>

                                    {viewMode === 'week' ? (
                                        <div className="space-y-4">
                                            {weekEvents.map(({ date, dateStr, events: dayEvents }) => {
                                                const dayName = dayNames[date.getDay()];
                                                const dayNumber = date.getDate();
                                                const isToday = dateStr === todayStr;

                                                return (
                                                    <div
                                                        key={dateStr}
                                                        className={`p-4 rounded-lg border-2 ${isToday
                                                            ? 'bg-primary-50 border-primary-300 shadow-sm'
                                                            : 'bg-white border-gray-200'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-12 h-12 rounded-full flex flex-col items-center justify-center ${isToday
                                                                    ? 'bg-primary-600 text-white'
                                                                    : 'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                    <span className="text-xs font-medium">{dayName}</span>
                                                                    <span className="text-lg font-bold">{dayNumber}</span>
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-900">
                                                                        {isToday ? 'Hoje' : date.toLocaleDateString('pt-BR', { weekday: 'long' })}
                                                                    </p>
                                                                    <p className="text-sm text-gray-600">
                                                                        {date.toLocaleDateString('pt-BR')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <Badge variant="info">
                                                                {dayEvents.length} {dayEvents.length === 1 ? 'sessão' : 'sessões'}
                                                            </Badge>
                                                        </div>

                                                        {dayEvents.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {dayEvents.map((event) => (
                                                                    <div
                                                                        key={event.id}
                                                                        className={`p-3 rounded-lg border ${event.completed
                                                                            ? 'bg-green-50 border-green-300'
                                                                            : event.title?.includes('Revisão Espaçada')
                                                                                ? 'bg-purple-50 border-purple-300'
                                                                                : 'bg-white border-gray-300'
                                                                            }`}
                                                                    >
                                                                        <div className="flex items-start justify-between">
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2 mb-1">
                                                                                    <span className="text-xl">{eventTypeIcons[event.event_type as keyof typeof eventTypeIcons]}</span>
                                                                                    <span className={`font-medium ${event.completed ? 'line-through text-gray-500' : 'text-gray-900'
                                                                                        }`}>
                                                                                        {event.title}
                                                                                    </span>
                                                                                    {event.area && (
                                                                                        <Badge variant="info">
                                                                                            {event.area}
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex gap-4 text-xs text-gray-500">
                                                                                    {event.start_time && (
                                                                                        <span>⏰ {event.start_time} - {event.end_time}</span>
                                                                                    )}
                                                                                    {event.description && (
                                                                                        <span className="truncate max-w-[200px]">{event.description}</span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <button
                                                                                    onClick={() => toggleComplete(event.id, event.completed)}
                                                                                    className={`p-2 rounded-lg transition-colors ${event.completed
                                                                                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                                        }`}
                                                                                >
                                                                                    <Check className="w-4 h-4" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => deleteEvent(event.id)}
                                                                                    className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                                                                                >
                                                                                    <X className="w-4 h-4" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-center py-4 text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-lg">
                                                                {date.getDay() === 0 ? '😴 Dia de descanso' : 'Nenhuma sessão para este dia.'}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* Monthly Grid */
                                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                                    <div key={d} className="py-2 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        {d}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-7 grid-rows-6 min-h-[600px]">
                                                {getMonthDays().map(({ date, dateStr, isCurrentMonth, isToday, events: dayEvents }, idx) => {
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`min-h-[100px] p-2 border-r border-b border-gray-100 transition-colors ${!isCurrentMonth ? 'bg-gray-50/50' : 'bg-white hover:bg-gray-50/30'
                                                                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                                                        >
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday
                                                                    ? 'bg-primary-600 text-white shadow-sm'
                                                                    : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
                                                                    }`}>
                                                                    {date.getDate()}
                                                                </span>
                                                            </div>
                                                            <div className="space-y-1">
                                                                {dayEvents.slice(0, 3).map(event => (
                                                                    <div
                                                                        key={event.id}
                                                                        className={`text-[10px] p-1 rounded border truncate leading-tight ${event.completed ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-800'}`}
                                                                        title={event.title}
                                                                    >
                                                                        {eventTypeIcons[event.event_type as keyof typeof eventTypeIcons]} {event.title}
                                                                    </div>
                                                                ))}
                                                                {dayEvents.length > 3 && (
                                                                    <div className="text-[9px] text-gray-500 font-bold pl-1">
                                                                        + {dayEvents.length - 3} mais
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    <ConfirmationModal
                        isOpen={modalConfig.isOpen}
                        onClose={closeModal}
                        onConfirm={modalConfig.onConfirm}
                        title={modalConfig.title}
                        message={modalConfig.message}
                        showCancel={modalConfig.type === 'confirm'}
                        confirmText={modalConfig.type === 'alert' ? 'OK' : 'Confirmar'}
                        variant={modalConfig.variant}
                    />
                </div>
            </div>
        </div>
    );
}
