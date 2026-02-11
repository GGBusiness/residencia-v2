'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Calendar as CalendarIcon, Check, X, Target } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { generateScheduleAction } from '@/app/actions/planner-actions';
import { Sparkles as SparklesIcon } from 'lucide-react';

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

import { ConfirmationModal } from '@/components/ui/modal';

export default function PlannerPage() {
    const router = useRouter();
    const { firstName, user, profile, goals } = useUser();
    const [events, setEvents] = useState<StudyEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
    const [generating, setGenerating] = useState(false);

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

    const handleGenerateSchedule = () => {
        if (!user?.id) return;

        showConfirm(
            'Gerar Cronograma IA',
            'Isso criará um cronograma automático para o próximo mês baseado no seu perfil. Continuar?',
            async () => {
                setGenerating(true);
                try {
                    const result = await generateScheduleAction(user.id);
                    if (result.success) {
                        showAlert('Sucesso!', 'Cronograma gerado com sucesso!');
                        // Refresh
                        window.location.reload();
                    } else {
                        console.error('Schedule gen error:', result.error);
                        showAlert('Erro', 'Erro ao gerar: ' + (result.error || 'Tente personalizar seu perfil antes.'));
                    }
                } catch (error) {
                    console.error('Failed to generate', error);
                    showAlert('Erro de Conexão', 'Verifique sua internet e tente novamente.');
                } finally {
                    setGenerating(false);
                }
            }
        );
    };

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        event_type: 'study' as 'study' | 'exam' | 'review',
        area: '',
        date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '12:00',
    });

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('study_events')
                .select('*')
                .order('date', { ascending: true })
                .order('start_time', { ascending: true });

            if (error) throw error;
            setEvents(data as StudyEvent[]);
        } catch (error) {
            console.error('Error loading events:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEvent = async () => {
        try {
            const { error } = await supabase
                .from('study_events')
                .insert([{
                    ...formData,
                    user_id: user?.id, // Use actual user ID
                }]);

            if (error) throw error;

            await loadEvents();
            setShowForm(false);
            setFormData({
                title: '',
                description: '',
                event_type: 'study',
                area: '',
                date: new Date().toISOString().split('T')[0],
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
            const { error } = await supabase
                .from('study_events')
                .update({ completed: !currentStatus })
                .eq('id', eventId);

            if (error) throw error;
            await loadEvents();
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
                    const { error } = await supabase
                        .from('study_events')
                        .delete()
                        .eq('id', eventId);

                    if (error) throw error;
                    await loadEvents();
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
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

        const week = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dayEvents = events.filter(e => e.date === dateStr);
            week.push({ date, dateStr, events: dayEvents });
        }
        return week;
    };

    const eventTypeIcons = {
        study: '📚',
        exam: '🎯',
        review: '🔄',
    };

    const eventTypeLabels = {
        study: 'Estudo',
        exam: 'Simulado',
        review: 'Revisão',
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando planner...</p>
                </div>
            </div>
        );
    }

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

                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                {firstName ? `Planner de ${firstName}` : '📅 Planner de Estudos'}
                            </h1>
                            <p className="text-gray-600">
                                {firstName
                                    ? `Organize suas sessões de estudo, ${firstName}`
                                    : 'Organize suas sessões de estudo'
                                }
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={handleGenerateSchedule}
                                disabled={generating}
                                className="border-purple-200 hover:bg-purple-50 text-purple-700"
                            >
                                {generating ? (
                                    'Gerando...'
                                ) : (
                                    <>
                                        <SparklesIcon className="w-4 h-4 mr-2 text-purple-500" />
                                        Gerar Cronograma IA
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => setShowForm(true)}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Nova Sessão
                            </Button>
                        </div>
                    </div>

                    {/* Banner de Metas Personalizadas */}
                    {profile && goals && (
                        <div className="mt-6 flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                                <Target className="w-4 h-4" />
                                Foco: {profile.target_institution} - {profile.target_specialty}
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium">
                                <CalendarIcon className="w-4 h-4" />
                                Meta: {goals.weekly_hours_goal}h/semana
                            </div>
                            <div className="flex-1 text-right text-xs text-slate-500 hidden md:block">
                                Horário de Ouro: <span className="capitalize">{profile.best_study_time}</span>
                            </div>
                        </div>
                    )}
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
                                        <option value="Cirurgia">Cirurgia</option>
                                        <option value="Clínica Médica">Clínica Médica</option>
                                        <option value="GO">GO</option>
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

                {/* Week View */}
                <Card>
                    <CardBody className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Semana Atual</h3>

                        <div className="space-y-4">
                            {weekEvents.map(({ date, dateStr, events: dayEvents }) => {
                                const dayName = dayNames[date.getDay()];
                                const dayNumber = date.getDate();
                                const isToday = dateStr === new Date().toISOString().split('T')[0];

                                return (
                                    <div
                                        key={dateStr}
                                        className={`p-4 rounded-lg border-2 ${isToday
                                            ? 'bg-primary-50 border-primary-300'
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
                                                        {date.toLocaleDateString('pt-BR', { weekday: 'long' })}
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
                                                            : 'bg-white border-gray-300'
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-xl">{eventTypeIcons[event.event_type]}</span>
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
                                                                {event.start_time && (
                                                                    <p className="text-sm text-gray-600">
                                                                        {event.start_time} - {event.end_time}
                                                                    </p>
                                                                )}
                                                                {event.description && (
                                                                    <p className="text-sm text-gray-600 mt-1">
                                                                        {event.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => toggleComplete(event.id, event.completed)}
                                                                    className={`p-2 rounded-lg transition-colors ${event.completed
                                                                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                        }`}
                                                                    title={event.completed ? 'Marcar como não concluído' : 'Marcar como concluído'}
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => deleteEvent(event.id)}
                                                                    className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                                                    title="Remover"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-10 px-4">
                                                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <SparklesIcon className="w-8 h-8 text-purple-600" />
                                                </div>
                                                <h3 className="text-lg font-bold text-gray-900 mb-2">
                                                    Nenhuma sessão agendada
                                                </h3>
                                                <p className="text-gray-600 max-w-sm mx-auto mb-6">
                                                    {profile
                                                        ? `Vamos criar um plano de estudos focado em ${profile.target_specialty} na ${profile.target_institution}?`
                                                        : 'Que tal deixar nossa IA organizar sua rotina de estudos?'}
                                                </p>
                                                <Button
                                                    onClick={handleGenerateSchedule}
                                                    variant="primary"
                                                    disabled={generating}
                                                >
                                                    {generating ? 'Criando seu plano...' : 'Criar Cronograma Personalizado'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardBody>
                </Card>
            </div>

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
    );
}
