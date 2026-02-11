'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { User, Clock, Target, Save, CheckCircle2 } from 'lucide-react';
import { updateUserDataAction, updateProfileSettingsAction, updateUserGoalsAction } from '@/app/actions/user-actions';

// Simple Tabs Component
const Tabs = ({ tabs, activeTab, onChange }: { tabs: { id: string; label: string; icon: any }[]; activeTab: string; onChange: (id: string) => void }) => (
    <div className="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
            <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
            >
                <tab.icon className="w-4 h-4" />
                {tab.label}
            </button>
        ))}
    </div>
);

export default function ProfilePage() {
    const { user, profile, goals, refreshUser } = useUser();
    const [activeTab, setActiveTab] = useState('dados');
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Form States
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        bestStudyTime: '',
        weeklyHoursGoal: 20,
    });

    // Load data when user/profile/goals are available
    useEffect(() => {
        if (user && profile && goals) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                bestStudyTime: profile.best_study_time || 'noite',
                weeklyHoursGoal: goals.weekly_hours_goal || 20,
            });
        }
    }, [user, profile, goals]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setSuccessMsg('');

        try {
            if (activeTab === 'dados') {
                await updateUserDataAction(user.id, { name: formData.name });
            } else if (activeTab === 'rotina') {
                await updateProfileSettingsAction(user.id, { best_study_time: formData.bestStudyTime });
            } else if (activeTab === 'metas') {
                await updateUserGoalsAction(user.id, { weekly_hours_goal: formData.weeklyHoursGoal });
            }

            // Refresh local data
            await refreshUser();
            setSuccessMsg('Alterações salvas com sucesso!');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            console.error('Failed to save', error);
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return <div className="p-8 text-center text-gray-500">Carregando perfil...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
                <p className="text-gray-500">Gerencie seus dados e preferências de estudo.</p>
            </div>

            <Card>
                <CardBody className="p-6">
                    <Tabs
                        activeTab={activeTab}
                        onChange={setActiveTab}
                        tabs={[
                            { id: 'dados', label: 'Meus Dados', icon: User },
                            { id: 'rotina', label: 'Minha Rotina', icon: Clock },
                            { id: 'metas', label: 'Minhas Metas', icon: Target },
                        ]}
                    />

                    <div className="space-y-6 max-w-xl">
                        {activeTab === 'dados' && (
                            <div className="space-y-4 animate-slide-up">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        disabled
                                        className="w-full rounded-lg border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed shadow-sm"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'rotina' && (
                            <div className="space-y-4 animate-slide-up">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Qual seu melhor horário para estudar?</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: 'manha', label: 'Manhã (06h - 12h)', icon: '☀️' },
                                            { id: 'tarde', label: 'Tarde (12h - 18h)', icon: '🌤️' },
                                            { id: 'noite', label: 'Noite (18h - 00h)', icon: '🌙' },
                                            { id: 'madrugada', label: 'Madrugada (00h - 06h)', icon: '🦉' },
                                        ].map((option) => (
                                            <div
                                                key={option.id}
                                                onClick={() => setFormData({ ...formData, bestStudyTime: option.id })}
                                                className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${formData.bestStudyTime === option.id
                                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                                                    : 'border-gray-200 hover:border-indigo-200'
                                                    }`}
                                            >
                                                <div className="text-2xl mb-1">{option.icon}</div>
                                                <div className="font-semibold">{option.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-3">
                                        Isso ajuda o Agente a sugerir tarefas no Planner nos horários que você rende mais.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'metas' && (
                            <div className="space-y-8 animate-slide-up">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="block text-sm font-medium text-gray-700">Meta Semanal de Horas</label>
                                        <span className="font-bold text-indigo-600 text-lg">{formData.weeklyHoursGoal}h</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="5"
                                        max="60"
                                        step="1"
                                        value={formData.weeklyHoursGoal}
                                        onChange={(e) => setFormData({ ...formData, weeklyHoursGoal: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>5h (Leve)</span>
                                        <span>30h (Intenso)</span>
                                        <span>60h (Insano)</span>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-lg flex gap-3">
                                    <Target className="w-5 h-5 text-blue-600 shrink-0" />
                                    <div>
                                        <p className="text-sm text-blue-900 font-medium">Impacto no Planner</p>
                                        <p className="text-xs text-blue-700 mt-1">
                                            Ao alterar sua meta, o Planner recalculará automaticamente a quantidade de tarefas diárias sugeridas.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex items-center gap-4">
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
                            >
                                {saving ? 'Salvando...' : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Salvar Alterações
                                    </>
                                )}
                            </Button>
                            {successMsg && (
                                <div className="flex items-center text-green-600 text-sm font-medium animate-fade-in">
                                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                    {successMsg}
                                </div>
                            )}
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
