'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { type OnboardingData } from '@/lib/user-service';
import { completeOnboardingAction, syncUserAction } from '@/app/actions/user-actions';
import { generateScheduleAction } from '@/app/actions/planner-actions'; // Import Planner Generator
import { ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Clock, Calendar } from 'lucide-react';

// Steps re-mapped: 
// 1 = Institution (was 3)
// 2 = Specialty (was 4)
// 3 = Availability (was 5)
// 4 = Best Time (was 6)
// 5 = Base (was 7)
type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);
    const [userName, setUserName] = useState(''); // To store display name

    const [formData, setFormData] = useState<OnboardingData>({
        name: '',
        email: '',
        target_institution: '',
        target_institutions: [],
        target_specialty: '',
        exam_timeframe: '3_6_meses',
        weekly_hours: 20,
        has_attempted_before: false,
        theoretical_base: 'media',
        best_study_time: 'noite',
    });

    const institutions = [
        'ENARE', 'ENAMED', 'USP', 'UNICAMP', 'UNIFESP',
        'SUS-SP', 'SUS-RJ', 'INCA', 'Todos',
    ];

    const specialties = [
        'Cirurgia Geral', 'Clínica Médica', 'Ginecologia e Obstetrícia', 'Pediatria',
        'Medicina Preventiva e Social', 'Ortopedia', 'Anestesiologia', 'Radiologia',
        'Cardiologia', 'Neurologia', 'Psiquiatria', 'Dermatologia', 'Oftalmologia', 'Todos',
    ];

    const timeframes = [
        { value: 'menos_3_meses', label: 'Menos de 3 meses' },
        { value: '3_6_meses', label: '3 a 6 meses' },
        { value: '6_12_meses', label: '6 a 12 meses' },
        { value: 'mais_1_ano', label: 'Mais de 1 ano' },
    ];

    const theoreticalBases = [
        { value: 'fraca', label: '😟 Fraca - Preciso revisar muito', emoji: '📚' },
        { value: 'media', label: '😊 Média - Sei o básico', emoji: '📖' },
        { value: 'boa', label: '😄 Boa - Domino bem', emoji: '✨' },
        { value: 'excelente', label: '🚀 Excelente - Muito seguro', emoji: '🎯' },
    ];

    const [userId, setUserId] = useState<string | null>(null);

    // Verificar autenticação e carregar dados do usuário
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth/login');
                return;
            }

            // Check if already onboarded to prevent loops
            const { data: userRecord } = await supabase
                .from('users')
                .select('onboarding_completed')
                .eq('id', user.id)
                .single();

            if (userRecord?.onboarding_completed) {
                router.push('/app');
                return;
            }

            setUserId(user.id);

            // Auto-fill Name and Email from Auth
            const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
            const email = user.email || '';

            setUserName(name.split(' ')[0] || 'Doutor(a)'); // First name for greeting

            setFormData(prev => ({
                ...prev,
                name: name,
                email: email
            }));
        };
        checkAuth();
    }, [router]);

    // Derived state for granular time input
    const [dailyHours, setDailyHours] = useState(4);
    const [studyDays, setStudyDays] = useState(5);

    // Sync granular inputs to formData.weekly_hours
    useEffect(() => {
        setFormData(prev => ({ ...prev, weekly_hours: dailyHours * studyDays }));
    }, [dailyHours, studyDays]);

    const handleNext = () => {
        if (currentStep < 5) {
            setCurrentStep((currentStep + 1) as Step);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep((currentStep - 1) as Step);
        }
    };

    const handleComplete = async () => {
        if (!userId) {
            alert('Erro: Usuário não identificado. Faça login novamente.');
            router.push('/auth/login');
            return;
        }

        setLoading(true);
        try {
            console.log('=== INICIANDO ONBOARDING (Server Action) ===');

            // 1. Sync User Data (Ensure Name/Email is fresh in DB)
            await syncUserAction(userId, formData.email, formData.name);

            // 2. Save Onboarding Profile
            const result = await completeOnboardingAction(userId, formData);

            if (result.success) {
                // 3. GENERATE AI PLANNER IMMEDIATELY
                console.log('🚀 [Onboarding] Triggering AI Planner generation...');
                const plannerResult = await generateScheduleAction(userId, new Date().toLocaleDateString('en-CA'));

                if (!plannerResult.success) {
                    console.warn('⚠️ [Onboarding] Planner generation failed:', plannerResult.error);
                    // We still redirect, but let the user know they might need to generate manually
                    alert(`✅ Perfil salvo! Mas houve um pequeno problema ao criar seu cronograma: ${plannerResult.error}. Você pode tentar gerá-lo manualmente no Planner.`);
                } else {
                    console.log('✅ [Onboarding] Planner generated successfully!');
                }

                // Redirecionar para dashboard
                router.push('/app');
            } else {
                console.error('Onboarding failed:', result.error);
                alert(`❌ Erro no salvamento: ${result.error || 'Erro desconhecido ao salvar.'}`);
            }
        } catch (error) {
            console.error('=== ERRO NO ONBOARDING ===', error);
            alert(`❌ Erro: ${error instanceof Error ? error.message : 'desconhecido'}.`);
        } finally {
            setLoading(false);
        }
    };

    const isStepValid = () => {
        switch (currentStep) {
            case 1: // Institution
                return (formData.target_institutions?.length || 0) > 0;
            case 2: // Specialty
                return formData.target_specialty !== '';
            case 3: // Availability
                return formData.weekly_hours > 0;
            case 4: // Best Time
                return true;
            case 5: // Base
                return true;
            default:
                return false;
        }
    };

    const progress = (currentStep / 5) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4 shadow-lg animate-pulse">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Bem-vindo(a), {userName}! 🎉
                    </h1>
                    <p className="text-lg text-gray-600">
                        Já te conhecemos! Agora vamos montar seu <strong>Plano de Estudos Perfeito</strong>.
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Etapa {currentStep} de 5</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-500 to-purple-500 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Card with Steps */}
                <Card className="mb-6 shadow-xl border-0">
                    <CardBody className="p-8">

                        {/* Step 1: Instituição (Was 3) */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Quais suas instituições alvo? 🎯
                                    </h2>
                                    <p className="text-gray-600">
                                        Selecione 1 a 3 bancas e ajuste o peso de cada uma.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {institutions.map((inst) => {
                                        const selected = formData.target_institutions?.some(t => t.institution === inst) || false;
                                        return (
                                            <button
                                                key={inst}
                                                onClick={() => {
                                                    const current = formData.target_institutions || [];
                                                    if (selected) {
                                                        // Remove
                                                        const remaining = current.filter(t => t.institution !== inst);
                                                        // Redistribute weights
                                                        if (remaining.length > 0) {
                                                            const perItem = Math.round(100 / remaining.length);
                                                            remaining.forEach((item, i) => {
                                                                item.weight = i === remaining.length - 1 ? 100 - perItem * (remaining.length - 1) : perItem;
                                                            });
                                                        }
                                                        setFormData({
                                                            ...formData,
                                                            target_institutions: remaining,
                                                            target_institution: remaining[0]?.institution || '',
                                                        });
                                                    } else if (current.length < 3) {
                                                        // Add
                                                        const newList = [...current, { institution: inst, weight: 0 }];
                                                        const perItem = Math.round(100 / newList.length);
                                                        newList.forEach((item, i) => {
                                                            item.weight = i === newList.length - 1 ? 100 - perItem * (newList.length - 1) : perItem;
                                                        });
                                                        // Primary = first selected or highest weight
                                                        const primary = newList.reduce((a, b) => a.weight >= b.weight ? a : b);
                                                        setFormData({
                                                            ...formData,
                                                            target_institutions: newList,
                                                            target_institution: primary.institution,
                                                        });
                                                    }
                                                }}
                                                disabled={!selected && (formData.target_institutions?.length || 0) >= 3}
                                                className={`p-4 rounded-lg border-2 transition-all transform hover:scale-105 ${selected
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold shadow-md'
                                                    : (formData.target_institutions?.length || 0) >= 3
                                                        ? 'border-gray-100 text-gray-300 cursor-not-allowed'
                                                        : 'border-gray-200 hover:border-primary-300 text-gray-600'
                                                    }`}
                                            >
                                                {inst}
                                                {selected && <span className="ml-1">✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Weight Sliders */}
                                {(formData.target_institutions?.length || 0) > 1 && (
                                    <div className="mt-4 bg-gray-50 rounded-xl p-5 space-y-4">
                                        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Peso de cada banca</p>
                                        {formData.target_institutions?.map((item, idx) => (
                                            <div key={item.institution} className="flex items-center gap-4">
                                                <span className="text-sm font-medium text-gray-700 w-24 truncate">{item.institution}</span>
                                                <input
                                                    type="range"
                                                    min="10"
                                                    max="90"
                                                    value={item.weight}
                                                    onChange={(e) => {
                                                        const newWeight = parseInt(e.target.value);
                                                        const others = formData.target_institutions!.filter((_, i) => i !== idx);
                                                        const remaining = 100 - newWeight;
                                                        const totalOtherWeights = others.reduce((s, o) => s + o.weight, 0);
                                                        const updated = formData.target_institutions!.map((t, i) => {
                                                            if (i === idx) return { ...t, weight: newWeight };
                                                            const ratio = totalOtherWeights > 0 ? t.weight / totalOtherWeights : 1 / others.length;
                                                            return { ...t, weight: Math.max(10, Math.round(remaining * ratio)) };
                                                        });
                                                        // Fix rounding
                                                        const sum = updated.reduce((s, t) => s + t.weight, 0);
                                                        if (sum !== 100) updated[updated.length - 1].weight += 100 - sum;
                                                        const primary = updated.reduce((a, b) => a.weight >= b.weight ? a : b);
                                                        setFormData({
                                                            ...formData,
                                                            target_institutions: updated,
                                                            target_institution: primary.institution,
                                                        });
                                                    }}
                                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                                />
                                                <span className="text-sm font-bold text-primary-700 w-12 text-right">{item.weight}%</span>
                                            </div>
                                        ))}
                                        {/* Visual weight bar */}
                                        <div className="flex h-3 rounded-full overflow-hidden">
                                            {formData.target_institutions?.map((item, i) => {
                                                const colors = ['bg-primary-500', 'bg-purple-500', 'bg-amber-500'];
                                                return <div key={item.institution} className={`${colors[i]} transition-all duration-300`} style={{ width: `${item.weight}%` }} />;
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 2: Especialidade (Was 4) */}
                        {currentStep === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Qual especialidade deseja? 🩺
                                    </h2>
                                    <p className="text-gray-600">
                                        Focaremos sua revisão nas áreas mais cobradas para {formData.target_specialty || 'sua escolha'}.
                                    </p>
                                </div>
                                <div>
                                    <select
                                        value={formData.target_specialty}
                                        onChange={(e) => setFormData({ ...formData, target_specialty: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg transition-shadow shadow-sm hover:shadow-md"
                                    >
                                        <option value="">Selecione...</option>
                                        {specialties.map((spec) => (
                                            <option key={spec} value={spec}>
                                                {spec}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Disponibilidade (Was 5) */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Quanto tempo tem disponível? ⏰
                                    </h2>
                                    <p className="text-gray-600">
                                        A IA vai encaixar os estudos na sua rotina real.
                                    </p>
                                </div>

                                <div className="bg-white p-6 rounded-xl border-2 border-gray-100 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Horas por dia: <strong className="text-primary-600 text-lg">{dailyHours}h</strong>
                                            </label>
                                            <input
                                                type="range"
                                                min="1"
                                                max="12"
                                                step="1"
                                                value={dailyHours}
                                                onChange={(e) => setDailyHours(parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                            />
                                            <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                                                <span>1h (Leve)</span>
                                                <span>12h (Hard)</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                                Dias por semana: <strong className="text-primary-600 text-lg">{studyDays} dias</strong>
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                                                    <button
                                                        key={d}
                                                        onClick={() => setStudyDays(d)}
                                                        className={`w-10 h-10 rounded-full font-bold transition-all ${studyDays === d
                                                            ? 'bg-primary-600 text-white shadow-lg transform scale-110'
                                                            : 'bg-white border-2 border-gray-200 text-gray-400 hover:border-primary-300 hover:text-primary-600'
                                                            }`}
                                                    >
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-primary-50 p-4 rounded-xl border border-primary-100 flex items-center justify-center gap-3">
                                    <Clock className="w-6 h-6 text-primary-600" />
                                    <p className="text-primary-800 font-medium text-lg">
                                        Meta Semanal: <strong>{formData.weekly_hours} horas</strong> 🚀
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Horário de Ouro (Was 6) */}
                        {currentStep === 4 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Qual seu horário de ouro? 🌟
                                    </h2>
                                    <p className="text-gray-600">
                                        Aquele momento em que você rende mais. Vamos priorizá-lo!
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { id: 'manha', label: 'Manhã (07h - 12h)', icon: '🌅' },
                                        { id: 'tarde', label: 'Tarde (13h - 18h)', icon: '☀️' },
                                        { id: 'noite', label: 'Noite (19h - 23h)', icon: '🌙' },
                                        { id: 'madrugada', label: 'Madrugada (23h - 04h)', icon: '🦉' },
                                        { id: 'variavel', label: 'Variável (Depende do plantão)', icon: '🔀' },
                                    ].map((time) => (
                                        <button
                                            key={time.id}
                                            onClick={() => setFormData({ ...formData, best_study_time: time.id as any })}
                                            className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-4 ${formData.best_study_time === time.id
                                                ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold shadow-md'
                                                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="text-3xl filter drop-shadow-sm">{time.icon}</span>
                                            <div>
                                                <p className="font-semibold text-lg">{time.label}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 5: Base Teórica (Was 7) */}
                        {currentStep === 5 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Como avalia sua base teórica? 📚
                                    </h2>
                                    <p className="text-gray-600">
                                        Seja honesto! Isso ajusta a dificuldade das questões iniciais.
                                    </p>
                                </div>

                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Já fez prova de residência antes?
                                    </label>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setFormData({ ...formData, has_attempted_before: true })}
                                            className={`flex-1 p-3 rounded-lg border-2 transition-all font-medium ${formData.has_attempted_before
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-gray-300 bg-white hover:border-green-300'
                                                }`}
                                        >
                                            ✅ Sim
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, has_attempted_before: false })}
                                            className={`flex-1 p-3 rounded-lg border-2 transition-all font-medium ${!formData.has_attempted_before
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-300 bg-white hover:border-blue-300'
                                                }`}
                                        >
                                            🆕 Não, é a primeira vez
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Nível de Conhecimento Atual
                                    </label>
                                    <div className="space-y-3">
                                        {theoreticalBases.map((base) => (
                                            <button
                                                key={base.value}
                                                onClick={() => setFormData({ ...formData, theoretical_base: base.value as any })}
                                                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${formData.theoretical_base === base.value
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold shadow-md transform scale-[1.02]'
                                                    : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <span className="text-3xl">{base.emoji}</span>
                                                <span className="text-lg">{base.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Navigation Buttons */}
                <div className="flex gap-4">
                    {currentStep > 1 && (
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            className="flex-1 py-6 text-lg border-2"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" />
                            Voltar
                        </Button>
                    )}

                    {currentStep < 5 ? (
                        <Button
                            variant="primary"
                            onClick={handleNext}
                            disabled={!isStepValid()}
                            className="flex-1 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
                        >
                            Próximo
                            <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={handleComplete}
                            disabled={loading}
                            className="flex-1 py-6 text-lg shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 border-0"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3" />
                                    Criando Planner com IA...
                                </>
                            ) : (
                                <>
                                    <Calendar className="w-5 h-5 mr-3" />
                                    Gerar Meu Planner!
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
