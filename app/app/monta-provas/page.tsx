'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Send, ChevronRight, Zap, Target, Brain, Search } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { getAvailableFilters, createAttempt, type AttemptConfig } from '@/lib/data-service';
import { useUser } from '@/hooks/useUser';
import { MultiSelectModal } from '@/components/ui/multi-select-modal';

type Step = 'welcome' | 'objective' | 'programs' | 'area' | 'difficulty' | 'questions' | 'years' | 'feedback' | 'plan';

const OBJETIVOS = [
    { id: 'prova-completa', label: 'Prova completa (simulado real)', icon: '📝' },
    { id: 'revisao-rapida', label: 'Revisão rápida', icon: '⚡' },
    { id: 'pontos-fracos', label: 'Treinar pontos fracos', icon: '💪' },
    { id: 'subarea-especifica', label: 'Treinar subárea específica', icon: '🎯' },
];

const POPULAR_PROGRAMS = ['ENARE', 'USP', 'UNICAMP', 'SUS-SP', 'PSU-MG', 'UFRJ', 'UNIFESP'];
const POPULAR_YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
const QUESTOES_OPTIONS = [15, 30, 60, 90, 120];

export default function MontaProvasPage() {
    const router = useRouter();
    const { firstName, user } = useUser();
    const [step, setStep] = useState<Step>('welcome');
    const [loadingFilters, setLoadingFilters] = useState(true);

    // Modal States
    const [isInstitutionsModalOpen, setIsInstitutionsModalOpen] = useState(false);
    const [isYearsModalOpen, setIsYearsModalOpen] = useState(false);

    // Dynamic Filters State
    const [availablePrograms, setAvailablePrograms] = useState<string[]>(POPULAR_PROGRAMS);
    const [availableYears, setAvailableYears] = useState<number[]>(POPULAR_YEARS);
    const [availableAreas, setAvailableAreas] = useState<string[]>([
        'Cirurgia Geral', 'Clínica Médica', 'Ginecologia e Obstetrícia',
        'Pediatria', 'Medicina Preventiva', 'Medicina de Família e Comunidade'
    ]);

    // Config
    const [config, setConfig] = useState({
        objetivo: '',
        area: '',
        questoes: 30,
        anos: [] as number[],
        programs: [] as string[],
        subareas: [] as string[],
        timer: 0,
        feedbackMode: 'PROVA' as 'PROVA' | 'ESTUDO',
        difficulty: 'todas',
    });

    const [messages, setMessages] = useState<Array<{ role: 'agent' | 'user'; content: string }>>([
        {
            role: 'agent',
            content: firstName
                ? `Olá, ${firstName}! 👋 Sou seu Agente de Provas. Posso montar um simulado perfeito para você.`
                : 'Olá! 👋 Sou seu Agente de Provas. Posso montar um simulado perfeito para você.',
        },
    ]);

    // Fetch filters
    useEffect(() => {
        async function loadFilters() {
            try {
                const filters = await getAvailableFilters();
                if (filters) {
                    if (filters.institutions && filters.institutions.length > 0) {
                        setAvailablePrograms(filters.institutions);
                    }
                    if (filters.years && filters.years.length > 0) {
                        setAvailableYears(filters.years);
                    }
                    if (filters.areas && filters.areas.length > 0) {
                        setAvailableAreas(filters.areas);
                    }
                }
            } catch (error) {
                console.error('Failed to load filters', error);
            } finally {
                setLoadingFilters(false);
            }
        }
        loadFilters();
    }, []);

    const addMessage = (role: 'agent' | 'user', content: string) => {
        setMessages((prev) => [...prev, { role, content }]);
    };

    const handleChoice = (choice: string, value: any) => {
        addMessage('user', choice);
        setTimeout(() => {
            switch (step) {
                case 'welcome':
                    setStep('objective');
                    addMessage('agent', 'Qual é o seu objetivo com esta prova?');
                    break;
                case 'objective':
                    setConfig({ ...config, objetivo: value });
                    setStep('programs');
                    addMessage('agent', 'De quais instituições você quer questões?');
                    break;
                case 'programs':
                    const selectedPrograms = value === 'todas' ? [] : (Array.isArray(value) ? value : [value]);
                    setConfig({ ...config, programs: selectedPrograms });
                    setStep('area');
                    addMessage('agent', 'Ótimo! Em qual grande área você quer focar?');
                    break;
                case 'area':
                    setConfig({ ...config, area: value });
                    setStep('difficulty');
                    addMessage('agent', 'Qual o nível de dificuldade das questões?');
                    break;
                case 'difficulty':
                    setConfig({ ...config, difficulty: value });
                    setStep('questions');
                    addMessage('agent', 'Quantas questões você quer responder?');
                    break;
                case 'questions':
                    setConfig({ ...config, questoes: value });
                    setStep('years');
                    addMessage('agent', 'De quais anos você quer questões?');
                    break;
                case 'years':
                    const selectedYears = value === 'all' ? availableYears : value;
                    setConfig({ ...config, anos: selectedYears });
                    setStep('feedback');
                    addMessage('agent', 'Como você prefere estudar?');
                    break;
                case 'feedback':
                    setConfig({ ...config, feedbackMode: value });
                    setStep('plan');
                    addMessage('agent', 'Perfeito! Deixa eu montar seu plano de prova...');
                    break;
            }
        }, 300);
    };

    const handleModalConfirm = (type: 'programs' | 'years', selected: string[]) => {
        if (type === 'programs') {
            setConfig({ ...config, programs: selected });
            setStep('area');
            addMessage('user', `Selecionadas ${selected.length} instituições`);
            addMessage('agent', 'Ótimo! Em qual grande área você quer focar?');
            setIsInstitutionsModalOpen(false);
        } else if (type === 'years') {
            const years = selected.map(y => parseInt(y));
            setConfig({ ...config, anos: years });
            setStep('feedback');
            addMessage('user', `Selecionados ${years.length} anos`);
            addMessage('agent', 'Como você prefere estudar?');
            setIsYearsModalOpen(false);
        }
    };

    const handleSmartExam = () => {
        addMessage('user', '✨ Montar Prova Inteligente (IA)');
        addMessage('agent', '🤖 Entendido! Analisando o banco de questões para criar o melhor treino possível...');
        setTimeout(() => {
            const smartPrograms = availablePrograms.slice(0, 5);
            const smartYears = availableYears.slice(0, 3);
            setConfig({
                objetivo: 'prova-completa',
                area: 'todas',
                questoes: 100,
                anos: smartYears.length > 0 ? smartYears : [2024, 2025, 2026],
                programs: smartPrograms,
                subareas: [],
                timer: 0,
                feedbackMode: 'PROVA',
                difficulty: 'todas',
            });
            setStep('plan');
            addMessage('agent', `✅ Configurei tudo: 100 questões das bancas disponíveis (${smartPrograms.join(', ')}...) dos anos mais recentes. Vamos nessa?`);
        }, 800);
    };

    const handleBack = () => {
        const stepOrder: Step[] = ['welcome', 'objective', 'programs', 'area', 'difficulty', 'questions', 'years', 'feedback', 'plan'];
        const currentIndex = stepOrder.indexOf(step);
        if (currentIndex > 0) {
            setStep(stepOrder[currentIndex - 1]);
            setMessages(prev => prev.slice(0, -2));
        }
    };

    const handleStartProva = async () => {
        if (!user) {
            addMessage('agent', '❌ Erro: Usuário não identificado. Tente recarregar a página.');
            return;
        }
        try {
            addMessage('agent', '🔍 Buscando questões no banco vetorial...');
            const { selectDocuments } = await import('@/lib/pdf-selector');
            const selectedDocs = await selectDocuments({
                area: config.area,
                years: config.anos,
                questionCount: config.questoes,
                programs: config.programs,
                objective: config.objetivo,
            });

            if (selectedDocs.length === 0) {
                addMessage('agent', '❌ Não encontrei provas suficientes. Tente diminuir os filtros.');
                return;
            }

            addMessage('agent', `✅ Encontrei ${selectedDocs.length} provas compatíveis! Gerando caderno...`);
            const attemptConfig: AttemptConfig = {
                mode: 'CUSTOM',
                feedbackMode: config.feedbackMode,
                documentIds: selectedDocs.map((d) => d.id),
                questionCount: config.questoes,
                timer: config.timer > 0 ? config.timer * 60 : undefined,
                objective: config.objetivo,
                area: config.area,
                subareas: config.subareas,
                programs: config.programs,
                years: config.anos,
                difficulty: config.difficulty,
            };

            const attempt = await createAttempt(attemptConfig, user.id);
            router.push(`/app/quiz/${attempt.id}`);
        } catch (error) {
            console.error('Error creating attempt:', error);
            addMessage('agent', '❌ Erro técnico ao criar prova.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse-slow">
                        <Brain className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Monta Provas <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Inteligente</span>
                    </h1>
                    <p className="text-gray-600">O Agente configura seu treino de Elite automaticamente.</p>
                </div>

                {/* Chat Messages */}
                <div className="space-y-4 mb-6">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-lg px-4 py-3 rounded-2xl shadow-sm animate-slide-up ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-900 border border-gray-100'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>

                {step !== 'welcome' && step !== 'plan' && (
                    <div className="mt-6 mb-4">
                        <Button variant="outline" className="w-full border-gray-300" onClick={handleBack}>
                            ← Voltar
                        </Button>
                    </div>
                )}

                {/* Choice Cards */}
                {step === 'welcome' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="border-2 border-indigo-500 shadow-xl transform transition-transform hover:scale-[1.02] cursor-pointer h-full" onClick={handleSmartExam}>
                            <CardBody className="p-6 relative overflow-hidden flex flex-col h-full">
                                <div className="absolute top-0 right-0 p-2 opacity-10"><Sparkles className="w-16 h-16" /></div>
                                <div className="flex flex-col gap-4 h-full">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shrink-0">IA</div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 leading-tight">PROVA INTELIGENTE (IA)</h3>
                                        <p className="text-indigo-700 font-medium text-sm mt-1">Foco em Alto Rendimento</p>
                                        <p className="text-xs text-gray-500 mt-2">O Agente escolhe as melhores questões.</p>
                                    </div>
                                    <div className="flex items-center text-indigo-600 font-bold text-sm mt-auto">COMEÇAR AGORA <ChevronRight className="w-4 h-4 ml-1" /></div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="border-2 border-gray-200 hover:border-indigo-400 shadow-lg transform transition-transform hover:scale-[1.02] cursor-pointer h-full" onClick={() => handleChoice('MONTE SUA PROVA', null)}>
                            <CardBody className="p-6 relative overflow-hidden flex flex-col h-full">
                                <div className="absolute top-0 right-0 p-2 opacity-10"><Target className="w-16 h-16" /></div>
                                <div className="flex flex-col gap-4 h-full">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold shrink-0">🛠️</div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 leading-tight">MONTE SUA PROVA</h3>
                                        <p className="text-gray-600 font-medium text-sm mt-1">100% Personalizável</p>
                                        <p className="text-xs text-gray-500 mt-2">Instituições, anos e dificuldade.</p>
                                    </div>
                                    <div className="flex items-center text-gray-600 font-bold text-sm mt-auto">CONFIGURAR <ChevronRight className="w-4 h-4 ml-1" /></div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                )}

                {step === 'objective' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {OBJETIVOS.map((obj) => (
                            <Card key={obj.id} hover onClick={() => handleChoice(obj.label, obj.id)} className="cursor-pointer">
                                <CardBody className="p-4">
                                    <div className="text-2xl mb-2">{obj.icon}</div>
                                    <p className="font-medium text-gray-900">{obj.label}</p>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}

                {step === 'programs' && (
                    <div className="space-y-3">
                        <Card hover onClick={() => handleChoice('Todas as instituições', 'todas')} className="cursor-pointer bg-indigo-50 border-indigo-200">
                            <CardBody className="p-4 flex items-center gap-3">
                                <span className="text-2xl">🏛️</span>
                                <span className="font-bold text-indigo-900">Todas as Instituições</span>
                            </CardBody>
                        </Card>

                        <button onClick={() => setIsInstitutionsModalOpen(true)} className="w-full p-4 bg-white border-2 border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 hover:border-indigo-500 transition-all group flex items-center justify-center gap-3 shadow-sm">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 group-hover:bg-indigo-200 flex items-center justify-center text-indigo-700">
                                <Search className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-indigo-900 group-hover:text-indigo-700">Selecionar Manualmente</p>
                                <p className="text-xs text-indigo-600">Buscar entre {availablePrograms.length} instituições...</p>
                            </div>
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {availablePrograms.slice(0, 6).map((program) => (
                                <Card key={program} hover onClick={() => handleChoice(program, program)} className="cursor-pointer">
                                    <CardBody className="p-4 flex items-center gap-3">
                                        <span className="text-2xl">🏥</span>
                                        <span className="font-medium text-gray-900 truncate">{program}</span>
                                    </CardBody>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'area' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Card key="todas" hover onClick={() => handleChoice('Todas as áreas', 'todas')} className="cursor-pointer bg-indigo-50 border-indigo-100">
                            <CardBody className="p-4 flex items-center gap-3">
                                <div className="text-2xl">🌐</div>
                                <p className="font-bold text-indigo-900 text-lg">Todas as áreas</p>
                            </CardBody>
                        </Card>
                        {availableAreas.map((area) => (
                            <Card key={area} hover onClick={() => handleChoice(area, area)} className="cursor-pointer">
                                <CardBody className="p-4 flex items-center gap-3">
                                    <div className="text-2xl">
                                        {area.includes('Cirurgia') ? '🔪' :
                                            area.includes('Clinica') || area.includes('Clínica') ? '🏥' :
                                                area.includes('Pediatria') ? '👶' :
                                                    area.includes('Preventiva') ? '🛡️' : '🩺'}
                                    </div>
                                    <p className="font-medium text-gray-900">{area}</p>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}

                {step === 'difficulty' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[{ id: 'todas', label: 'Todas', icon: '🌟' }, { id: 'Faca na caveira', label: 'Difícil', icon: '💀' }, { id: 'Média', label: 'Média', icon: '⚖️' }, { id: 'Fácil', label: 'Fácil', icon: '😌' }].map((diff) => (
                            <Card key={diff.id} hover onClick={() => handleChoice(diff.label, diff.id)} className="cursor-pointer">
                                <CardBody className="p-4">
                                    <div className="text-2xl mb-2">{diff.icon}</div>
                                    <p className="font-medium text-gray-900">{diff.label}</p>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}

                {step === 'questions' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {QUESTOES_OPTIONS.map((num) => (
                            <Card key={num} hover onClick={() => handleChoice(`${num} questões`, num)} className="cursor-pointer">
                                <CardBody className="p-4 text-center">
                                    <p className="text-2xl font-bold text-indigo-600">{num}</p>
                                    <p className="text-[10px] text-gray-600 mt-1 uppercase">questões</p>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                )}

                {step === 'years' && (
                    <Card>
                        <CardBody className="p-6 space-y-3">
                            <button onClick={() => handleChoice('Todos os Anos', 'all')} className="w-full p-4 text-left border-2 border-indigo-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-300 mb-2 transition-colors">
                                <p className="font-bold text-gray-900">Todos os Anos Disponíveis</p>
                                <p className="text-sm text-gray-500">{availableYears.length > 0 ? `${Math.min(...availableYears)} - ${Math.max(...availableYears)}` : 'Carregando...'}</p>
                            </button>
                            <button onClick={() => setIsYearsModalOpen(true)} className="w-full p-3 border-2 border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700 font-medium transition-colors flex items-center justify-center gap-2">
                                <span className="text-lg">📅</span> Selecionar Anos Específicos...
                            </button>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-4">
                                {availableYears.slice(0, 8).map((year) => (
                                    <button key={year} onClick={() => handleChoice(year.toString(), [year])} className="p-3 border rounded-xl hover:bg-indigo-50 hover:border-indigo-300 text-center font-medium transition-colors">
                                        {year}
                                    </button>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                )}

                {step === 'feedback' && (
                    <div className="grid grid-cols-2 gap-4">
                        <Card hover onClick={() => handleChoice('Modo Prova', 'PROVA')} className="cursor-pointer border-2 border-indigo-100 hover:border-indigo-500">
                            <CardBody className="p-6 text-center">
                                <Target className="w-8 h-8 mx-auto text-indigo-600 mb-2" />
                                <h3 className="font-bold">Modo Prova</h3>
                            </CardBody>
                        </Card>
                        <Card hover onClick={() => handleChoice('Modo Estudo', 'ESTUDO')} className="cursor-pointer border-2 border-indigo-100 hover:border-indigo-500">
                            <CardBody className="p-6 text-center">
                                <Zap className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
                                <h3 className="font-bold">Modo Estudo</h3>
                            </CardBody>
                        </Card>
                    </div>
                )}

                {step === 'plan' && (
                    <Card className="border-2 border-indigo-500 bg-white shadow-2xl">
                        <CardBody className="p-8">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Sparkles className="w-8 h-8 text-green-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900">Plano Gerado</h2>
                                <p className="text-gray-600">Estratégia montada:</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-6 space-y-4 mb-8">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Questões</span>
                                    <span className="font-bold text-xl text-indigo-600">{config.questoes}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Foco</span>
                                    <span className="font-bold text-gray-900">{config.area === 'todas' ? 'Geral (R1)' : config.area}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Instituições</span>
                                    <span className="font-medium text-right text-gray-900 max-w-[50%]">
                                        {config.programs.length > 0 ? config.programs.join(', ') : 'Todas'}
                                    </span>
                                </div>
                            </div>
                            <Button variant="primary" className="w-full text-lg py-6 shadow-lg bg-indigo-600 hover:bg-indigo-700" onClick={handleStartProva}>
                                🚀 Começar Agora
                            </Button>
                            <Button variant="ghost" className="w-full mt-2" onClick={() => setStep('objective')}>
                                Ajustar Manualmente
                            </Button>
                        </CardBody>
                    </Card>
                )}
            </div>

            <MultiSelectModal
                isOpen={isInstitutionsModalOpen}
                onClose={() => setIsInstitutionsModalOpen(false)}
                title="Selecione as Instituições"
                searchPlaceholder="Buscar instituição (ex: USP, ENARE)..."
                items={availablePrograms}
                selectedItems={config.programs}
                onConfirm={(selected) => handleModalConfirm('programs', selected)}
            />

            <MultiSelectModal
                isOpen={isYearsModalOpen}
                onClose={() => setIsYearsModalOpen(false)}
                title="Selecione os Anos"
                searchPlaceholder="Buscar ano..."
                items={availableYears.map(y => y.toString())}
                selectedItems={config.anos.map(y => y.toString())}
                onConfirm={(selected) => handleModalConfirm('years', selected)}
            />
        </div>
    );
}
