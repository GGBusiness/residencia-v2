
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { getReviewStatsAction, startReviewSessionAction } from '@/app/actions/study-actions';
import { supabase } from '@/lib/supabase';
import { Brain, Calendar, CheckCircle2, Clock, Play } from 'lucide-react';

interface ReviewStats {
    totalDue: number;
    nextReviewDate: string | null;
}

export default function ReviewDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<ReviewStats>({ totalDue: 0, nextReviewDate: null });
    const [loading, setLoading] = useState(true);
    const [startingReview, setStartingReview] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const result = await getReviewStatsAction(session.user.id);

            if (result.success && result.data) {
                setStats({
                    totalDue: result.data.totalDue,
                    nextReviewDate: result.data.nextReviewDate
                });
            }
        } catch (error) {
            console.error('Error loading review stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const startReview = async () => {
        try {
            setStartingReview(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const result = await startReviewSessionAction(session.user.id);

            if (result.success && result.attemptId) {
                router.push(`/app/quiz/${result.attemptId}`);
            } else {
                alert(result.error || 'Erro ao iniciar revisão.');
            }

        } catch (error) {
            console.error('Error starting review:', error);
            alert('Erro ao iniciar revisão.');
        } finally {
            setStartingReview(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando estatísticas...</div>;
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Brain className="w-8 h-8 text-primary-600" />
                Central de Revisões
            </h1>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Main Card */}
                <Card className="border-t-4 border-t-primary-500 shadow-md">
                    <CardBody className="text-center py-10">
                        <div className="bg-primary-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Clock className="w-10 h-10 text-primary-600" />
                        </div>

                        <h2 className="text-xl font-semibold text-gray-900 mb-1">Revisões Pendentes</h2>
                        <div className="text-5xl font-bold text-primary-600 my-4">
                            {stats.totalDue}
                        </div>
                        <p className="text-gray-500 mb-8">Cartões agendados para hoje</p>

                        <Button
                            onClick={startReview}
                            disabled={stats.totalDue === 0 || startingReview}
                            className="w-full max-w-xs"
                            size="lg"
                        >
                            {startingReview ? 'Preparando...' : (
                                <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Começar Revisão
                                </>
                            )}
                        </Button>
                    </CardBody>
                </Card>

                {/* Info Card */}
                <div className="space-y-6">
                    <Card>
                        <CardBody>
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-gray-500" />
                                Próximas Revisões
                            </h3>
                            {stats.nextReviewDate ? (
                                <div className="text-center py-4">
                                    <p className="text-gray-500 text-sm">Próximo cartão disponível em:</p>
                                    <p className="text-lg font-medium text-gray-900 mt-1">
                                        {new Date(stats.nextReviewDate).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm text-center py-4">
                                    Nenhuma revisão futura agendada. Continue estudando!
                                </p>
                            )}
                        </CardBody>
                    </Card>

                    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-none">
                        <CardBody>
                            <h3 className="font-semibold text-purple-900 mb-2">Como funciona?</h3>
                            <ul className="space-y-2 text-sm text-purple-800">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                                    O sistema usa inteligência artificial para calcular quando você vai esquecer cada assunto.
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                                    Revise apenas o necessário, economizando tempo e fixando melhor o conteúdo.
                                </li>
                            </ul>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}
