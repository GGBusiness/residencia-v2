'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { type OnboardingData } from '@/lib/user-service';
import { completeOnboardingAction } from '@/app/actions/user-actions';
import { ArrowRight, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function OnboardingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState<OnboardingData>({
        name: '',
        email: '',
        target_institution: '',
        target_specialty: '',
        exam_timeframe: '3_6_meses',
        weekly_hours: 20,
        has_attempted_before: false,
        theoretical_base: 'media',
    });

    const institutions = [
        'ENARE',
        'ENAMED',
        'USP',
        'UNICAMP',
        'UNIFESP',
        'SUS-SP',
        'SUS-RJ',
        'INCA',
        'Outros',
    ];

    const specialties = [
        'Cirurgia Geral',
        'Clínica Médica',
        'Ginecologia e Obstetrícia',
        'Pediatria',
        'Medicina Preventiva e Social',
        'Ortopedia',
        'Anestesiologia',
        'Radiologia',
        'Cardiologia',
        'Neurologia',
        'Psiquiatria',
        'Dermatologia',
        'Oftalmologia',
        'Outros',
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

    // Verificar autenticação ao carregar
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/auth/login');
                return;
            }
            setUserId(user.id);
        };
        checkAuth();
    }, [router]);

    const handleNext = () => {
        if (currentStep < 6) {
            setCurrentStep((currentStep + 1) as Step);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep((currentStep - 1) as Step);
        }
    };



    // ... inside component

    const handleComplete = async () => {
        if (!userId) {
            alert('Erro: Usuário não identificado. Faça login novamente.');
            router.push('/auth/login');
            return;
        }

        setLoading(true);
        try {
            console.log('=== INICIANDO ONBOARDING (Server Action) ===');
            console.log('UserID:', userId);

            // Server Action call
            const result = await completeOnboardingAction(userId, formData);

            console.log('Resultado completeOnboarding:', result);

            if (result.success) {
                // Redirecionar para dashboard
                router.push('/app');
            } else {
                alert('❌ Erro ao salvar dados. Tente novamente.');
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
            case 1:
                return formData.name.trim().length > 2;
            case 2:
                return formData.email.includes('@');
            case 3:
                return formData.target_institution !== '';
            case 4:
                return formData.target_specialty !== '';
            case 5:
                return formData.weekly_hours > 0;
            case 6:
                return true;
            default:
                return false;
        }
    };

    const progress = (currentStep / 6) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-full mb-4">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">
                        Bem-vindo! 🎉
                    </h1>
                    <p className="text-lg text-gray-600">
                        Vamos personalizar sua jornada de estudos
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Etapa {currentStep} de 6</span>
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
                <Card className="mb-6">
                    <CardBody className="p-8">
                        {/* Step 1: Nome */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Como você se chama?
                                    </h2>
                                    <p className="text-gray-600">
                                        Queremos te conhecer melhor e personalizar sua experiência! 😊
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nome completo *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg"
                                        placeholder="Ex: Maria Silva"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Email */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Qual seu e-mail?
                                    </h2>
                                    <p className="text-gray-600">
                                        Usaremos para enviar relatórios e lembretes de estudo.
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        E-mail *
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg"
                                        placeholder="seuemail@exemplo.com"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 3: Instituição */}
                        {currentStep === 3 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Qual sua instituição alvo? 🎯
                                    </h2>
                                    <p className="text-gray-600">
                                        Isso nos ajudará a calcular suas metas de estudo.
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {institutions.map((inst) => (
                                        <button
                                            key={inst}
                                            onClick={() => setFormData({ ...formData, target_institution: inst })}
                                            className={`p-4 rounded-lg border-2 transition-all ${formData.target_institution === inst
                                                ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                                                : 'border-gray-300 hover:border-primary-300 text-gray-700'
                                                }`}
                                        >
                                            {inst}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 4: Especialidade */}
                        {currentStep === 4 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Qual especialidade deseja? 🩺
                                    </h2>
                                    <p className="text-gray-600">
                                        Vamos focar seus estudos nesta área.
                                    </p>
                                </div>
                                <div>
                                    <select
                                        value={formData.target_specialty}
                                        onChange={(e) => setFormData({ ...formData, target_specialty: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg"
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

                        {/* Step 5: Disponibilidade */}
                        {currentStep === 5 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Quanto tempo tem disponível? ⏰
                                    </h2>
                                    <p className="text-gray-600">
                                        Isso ajudará a definir suas metas semanais.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Prazo para a prova
                                    </label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {timeframes.map((tf) => (
                                            <button
                                                key={tf.value}
                                                onClick={() => setFormData({ ...formData, exam_timeframe: tf.value as any })}
                                                className={`p-3 rounded-lg border-2 transition-all text-left ${formData.exam_timeframe === tf.value
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                                                    : 'border-gray-300 hover:border-primary-300'
                                                    }`}
                                            >
                                                {tf.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Horas disponíveis por semana: <strong>{formData.weekly_hours}h</strong>
                                    </label>
                                    <input
                                        type="range"
                                        min="5"
                                        max="50"
                                        step="5"
                                        value={formData.weekly_hours}
                                        onChange={(e) => setFormData({ ...formData, weekly_hours: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                    />
                                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                                        <span>5h</span>
                                        <span>25h</span>
                                        <span>50h</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 6: Base Teórica */}
                        {currentStep === 6 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                        Como avalia sua base teórica? 📚
                                    </h2>
                                    <p className="text-gray-600">
                                        Seja honesto! Isso ajudará a balancear teoria e prática.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Já fez prova de residência antes?
                                    </label>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setFormData({ ...formData, has_attempted_before: true })}
                                            className={`flex-1 p-4 rounded-lg border-2 transition-all ${formData.has_attempted_before
                                                ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                                                : 'border-gray-300 hover:border-primary-300'
                                                }`}
                                        >
                                            ✅ Sim
                                        </button>
                                        <button
                                            onClick={() => setFormData({ ...formData, has_attempted_before: false })}
                                            className={`flex-1 p-4 rounded-lg border-2 transition-all ${!formData.has_attempted_before
                                                ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                                                : 'border-gray-300 hover:border-primary-300'
                                                }`}
                                        >
                                            ⭕ Não
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Autoavaliação da base teórica
                                    </label>
                                    <div className="space-y-2">
                                        {theoreticalBases.map((base) => (
                                            <button
                                                key={base.value}
                                                onClick={() => setFormData({ ...formData, theoretical_base: base.value as any })}
                                                className={`w-full p-4 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${formData.theoretical_base === base.value
                                                    ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                                                    : 'border-gray-300 hover:border-primary-300'
                                                    }`}
                                            >
                                                <span className="text-2xl">{base.emoji}</span>
                                                <span>{base.label}</span>
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
                            className="flex-1"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar
                        </Button>
                    )}

                    {currentStep < 6 ? (
                        <Button
                            variant="primary"
                            onClick={handleNext}
                            disabled={!isStepValid()}
                            className="flex-1"
                        >
                            Próximo
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={handleComplete}
                            disabled={loading}
                            className="flex-1"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Finalizar
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
