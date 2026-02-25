'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { History as HistoryIcon, Calendar, Award, Eye, FileText } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/hooks/useUser';
import { getHistoryAction } from '@/app/actions/history-actions';

export default function HistoricoPage() {
    const router = useRouter();
    const { user, firstName, loading: userLoading } = useUser();
    const [attempts, setAttempts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userLoading) return;

        if (user) {
            loadHistory();
        } else {
            setLoading(false);
        }
    }, [user, userLoading]);

    const loadHistory = async () => {
        try {
            if (!user?.id) return;

            const result = await getHistoryAction(user.id);
            if (result.success) {
                setAttempts(result.data || []);
            } else {
                console.error('Error loading history:', result.error);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando histórico...</p>
                </div>
            </div>
        );
    }

    const completedAttempts = attempts.filter(a => a.status === 'COMPLETED');
    const inProgressAttempts = attempts.filter(a => a.status === 'IN_PROGRESS');

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {firstName ? `Histórico de Provas - ${firstName}` : '📜 Histórico de Provas'}
                </h1>
                <p className="text-gray-600">
                    {firstName
                        ? `Aqui estão todas as suas tentativas e resultados, ${firstName}`
                        : 'Todas as suas tentativas e resultados'
                    }
                </p>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <HistoryIcon className="w-8 h-8" />
                            <h3 className="text-lg font-semibold">Total de Provas</h3>
                        </div>
                        <p className="text-4xl font-bold">{attempts.length}</p>
                    </CardBody>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Award className="w-8 h-8" />
                            <h3 className="text-lg font-semibold">Concluídas</h3>
                        </div>
                        <p className="text-4xl font-bold">{completedAttempts.length}</p>
                    </CardBody>
                </Card>

                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Calendar className="w-8 h-8" />
                            <h3 className="text-lg font-semibold">Em Andamento</h3>
                        </div>
                        <p className="text-4xl font-bold">{inProgressAttempts.length}</p>
                    </CardBody>
                </Card>
            </div>

            {/* Lista de Tentativas */}
            {attempts.length === 0 ? (
                <Card>
                    <CardBody className="p-12 text-center">
                        <HistoryIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Nenhuma prova realizada ainda
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Comece agora criando sua primeira prova personalizada!
                        </p>
                        <Button
                            variant="primary"
                            onClick={() => router.push('/app/monta-provas')}
                        >
                            Montar Primeira Prova
                        </Button>
                    </CardBody>
                </Card>
            ) : (
                <div className="space-y-4">
                    {attempts.map((attempt) => {
                        const config = attempt.config || {};
                        const createdAt = new Date(attempt.started_at);
                        const isCompleted = attempt.status === 'COMPLETED';

                        // Use stats saved by finishQuizAction
                        const correctCount = attempt.correct_answers || 0;
                        const totalCount = attempt.total_questions || config.questionCount || 0;
                        const percentage = attempt.percentage || (totalCount > 0 ? (correctCount / totalCount) * 100 : 0);

                        return (
                            <Card key={attempt.id} hover>
                                <CardBody className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <h3 className="text-xl font-bold text-gray-900">
                                                    Prova {createdAt.toLocaleDateString('pt-BR')} - {createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </h3>
                                                <Badge variant={isCompleted ? 'success' : 'warning'}>
                                                    {isCompleted ? '✓ Concluída' : '⏳ Em Andamento'}
                                                </Badge>
                                            </div>

                                            {/* Configuração da Prova */}
                                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                    <FileText className="w-4 h-4" />
                                                    Configuração
                                                </h4>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    {config.programs && config.programs.length > 0 && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">Instituição</p>
                                                            <p className="font-semibold text-gray-900">
                                                                {config.programs.join(', ')}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {config.area && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">Área Médica</p>
                                                            <p className="font-semibold text-gray-900">{config.area}</p>
                                                        </div>
                                                    )}
                                                    {config.anos && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">Anos</p>
                                                            <p className="font-semibold text-gray-900">
                                                                {config.anos.join(', ')}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {config.questionsCount && (
                                                        <div>
                                                            <p className="text-xs text-gray-500 mb-1">Questões</p>
                                                            <p className="font-semibold text-gray-900">
                                                                {config.questionsCount} questões
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Resultado (se concluído) */}
                                            {isCompleted && (
                                                <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg p-4">
                                                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                        <Award className="w-4 h-4" />
                                                        Resultado
                                                    </h4>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div className="text-center">
                                                            <p className="text-3xl font-bold text-primary-600">
                                                                {percentage.toFixed(0)}%
                                                            </p>
                                                            <p className="text-xs text-gray-600">Aproveitamento</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-3xl font-bold text-green-600">
                                                                {correctCount}
                                                            </p>
                                                            <p className="text-xs text-gray-600">Acertos</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-3xl font-bold text-gray-900">
                                                                {totalCount}
                                                            </p>
                                                            <p className="text-xs text-gray-600">Total</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <Button
                                            variant={isCompleted ? "outline" : "primary"}
                                            size="sm"
                                            onClick={() => router.push(`/app/quiz/${attempt.id}`)}
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            {isCompleted ? 'Revisar Prova' : 'Continuar'}
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
