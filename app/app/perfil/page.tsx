'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Clock, Target, Save, CheckCircle2 } from 'lucide-react';
import { updateUserDataAction, updateProfileSettingsAction, updateUserGoalsAction } from '@/app/actions/user-actions';

export default function ProfilePage() {
    const { user, profile, goals, refreshUser } = useUser();
    const [saving, setSaving] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    // Form States
    const [formData, setFormData] = useState({
        name: '',
        targetInstitution: '',
        targetSpecialty: '',
        bestStudyTime: '',
        weeklyHoursGoal: 20,
    });

    // Load data when user/profile/goals are available
    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                targetInstitution: profile?.target_institution || '',
                targetSpecialty: profile?.target_specialty || '',
                bestStudyTime: profile?.best_study_time || 'noite',
                weeklyHoursGoal: goals?.weekly_hours_goal || 20,
            });
        }
    }, [user, profile, goals]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setSuccessMsg('');

        try {
            // 1. Sync User Name (UPSERT)
            const { syncUserAction } = await import('@/app/actions/user-actions');
            await syncUserAction(user.id, user.email, formData.name);

            // 2. Update Profile (Institution, Specialty, Routine)
            await updateProfileSettingsAction(user.id, {
                target_institution: formData.targetInstitution,
                target_specialty: formData.targetSpecialty,
                best_study_time: formData.bestStudyTime
            });

            // 3. Update Goals (Weekly Hours)
            await updateUserGoalsAction(user.id, { weekly_hours_goal: formData.weeklyHoursGoal });

            // Refresh local data
            await refreshUser();
            setSuccessMsg('Perfil atualizado com sucesso!');
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
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header Simplified */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-700">
                    {user?.name ? user.name.substring(0, 2).toUpperCase() : 'DR'}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{user?.name || 'Doutor(a)'}</h1>
                    <p className="text-gray-500">{user?.email}</p>
                    <div className="flex gap-2 mt-2">
                        <Badge variant="success">Conta Ativa</Badge>
                        <Badge variant="info">Resident PRO</Badge>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <div className="bg-indigo-600 p-2 rounded-lg text-white">
                        <User className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">Personalizar App</h2>
                </div>

                <div className="p-8 space-y-8">
                    {/* Seção 1: Dados Pessoais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                                <span className="text-lg">👤</span> Dados Pessoais
                            </h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-white border"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                <input
                                    type="email"
                                    value={user.email}
                                    disabled
                                    className="w-full rounded-lg border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed shadow-sm p-2.5 border"
                                />
                            </div>
                        </div>

                        {/* Seção 2: Foco Residência */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                                <span className="text-lg">🎯</span> Foco da Residência
                            </h3>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Instituição Alvo</label>
                                <select
                                    value={formData.targetInstitution}
                                    onChange={(e) => setFormData({ ...formData, targetInstitution: e.target.value })}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-white border"
                                >
                                    <option value="">Selecione...</option>
                                    {['ENARE', 'ENAMED', 'USP', 'UNICAMP', 'UNIFESP', 'SUS-SP', 'SUS-RJ', 'INCA', 'Todos'].map(inst => (
                                        <option key={inst} value={inst}>{inst}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade Desejada</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Cardiologia, Dermatologia..."
                                    value={formData.targetSpecialty}
                                    onChange={(e) => setFormData({ ...formData, targetSpecialty: e.target.value })}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-white border"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Seção 3: Rotina de Estudos */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 border-b pb-2 flex items-center gap-2">
                            <span className="text-lg">⏰</span> Rotina de Estudos
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-3 block">Melhor horário para estudar</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'manha', label: 'Manhã', icon: '☀️' },
                                        { id: 'tarde', label: 'Tarde', icon: '🌤️' },
                                        { id: 'noite', label: 'Noite', icon: '🌙' },
                                        { id: 'madrugada', label: 'Madru.', icon: '🦉' },
                                    ].map((option) => (
                                        <div
                                            key={option.id}
                                            onClick={() => setFormData({ ...formData, bestStudyTime: option.id })}
                                            className={`cursor-pointer p-3 rounded-lg border text-center transition-all ${formData.bestStudyTime === option.id
                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold'
                                                : 'border-gray-200 hover:border-indigo-200'
                                                }`}
                                        >
                                            <div className="text-lg">{option.icon}</div>
                                            <div className="text-sm">{option.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

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
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mb-2"
                                />
                                <p className="text-xs text-gray-500">
                                    Define quantas tarefas o <strong>Planner IA</strong> vai sugerir para você.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Botão Salvar */}
                    <div className="pt-6 flex flex-col md:flex-row items-center gap-4 border-t border-slate-100">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 text-base rounded-xl shadow-lg shadow-indigo-200"
                        >
                            {saving ? 'Salvando...' : (
                                <>
                                    <Save className="w-5 h-5 mr-2" />
                                    Salvar Alterações
                                </>
                            )}
                        </Button>
                        {successMsg && (
                            <div className="flex items-center text-green-600 text-sm font-medium animate-fade-in bg-green-50 px-4 py-2 rounded-lg w-full md:w-auto md:flex-1 justify-center md:justify-start">
                                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                                {successMsg}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
