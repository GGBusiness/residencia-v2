'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    CheckCircle2,
    XCircle,
    AlertCircle,
    Trophy,
    Clock,
    ChevronDown,
    ChevronUp,
    Home,
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAttempt, getAttemptAnswers, type Attempt, type AttemptAnswer } from '@/lib/data-service';
import Link from 'next/link';

// Mock questions
const MOCK_QUESTIONS = Array.from({ length: 60 }, (_, i) => ({
    id: `q-${i + 1}`,
    number: i + 1,
    stem: `Questão ${i + 1}: Paciente de 45 anos apresenta dor torácica há 2 horas. Qual a conduta mais adequada?`,
    options: {
        A: 'Opção A - Conduta A',
        B: 'Opção B - Conduta B',
        C: 'Opção C - Conduta C',
        D: 'Opção D - Conduta D',
        E: 'Opção E - Conduta E',
    },
    correctOption: 'C',
    explanation: 'A resposta correta é C porque esta é a conduta mais adequada neste cenário clínico. O paciente apresenta sinais clássicos que indicam essa abordagem como primeira escolha terapêutica.',
}));

export default function ResultPage() {
    const router = useRouter();
    const params = useParams();
    const attemptId = params.attemptId as string;

    const [attempt, setAttempt] = useState<Attempt | null>(null);
    const [answers, setAnswers] = useState<Record<number, AttemptAnswer>>({});
    const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
    const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect' | 'unanswered'>('all');

    useEffect(() => {
        loadResult();
    }, []);

    const loadResult = async () => {
        try {
            const attemptData = await getAttempt(attemptId);
            setAttempt(attemptData);

            const answersData = await getAttemptAnswers(attemptId);
            const answersMap: Record<number, AttemptAnswer> = {};
            answersData.forEach((ans) => {
                answersMap[ans.question_index] = ans;
            });
            setAnswers(answersMap);
        } catch (error) {
            console.error('Error loading result:', error);
        }
    };

    const getQuestionStatus = (questionIndex: number) => {
        const answer = answers[questionIndex];
        if (!answer || !answer.choice) return 'unanswered';

        const question = MOCK_QUESTIONS[questionIndex];
        if (!question.correctOption) return 'no-key';

        return answer.choice === question.correctOption ? 'correct' : 'incorrect';
    };

    const stats = {
        total: MOCK_QUESTIONS.length,
        answered: Object.values(answers).filter((a) => a.choice).length,
        correct: MOCK_QUESTIONS.filter((q, idx) =>
            answers[idx]?.choice === q.correctOption
        ).length,
        incorrect: MOCK_QUESTIONS.filter(
            (q, idx) => answers[idx]?.choice && answers[idx].choice !== q.correctOption
        ).length,
        unanswered: MOCK_QUESTIONS.length -
            Object.values(answers).filter((a) => a.choice).length,
    };

    const score = stats.answered > 0
        ? Math.round((stats.correct / stats.answered) * 100)
        : 0;

    const filteredQuestions = MOCK_QUESTIONS.filter((q, idx) => {
        const status = getQuestionStatus(idx);
        if (filter === 'all') return true;
        return status === filter;
    });

    if (!attempt) {
        return <div>Carregando...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-primary-600 to-purple-600 px-4 py-12">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Trophy className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Prova Finalizada!
                    </h1>
                    <p className="text-primary-100">
                        Confira seu desempenho e revise as questões
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8 -mt-8">
                {/* Performance Card */}
                <Card className="mb-8 shadow-xl">
                    <CardBody className="p-8">
                        <div className="text-center mb-6">
                            <div className="text-6xl font-bold text-primary-600 mb-2">
                                {score}%
                            </div>
                            <p className="text-gray-600">Taxa de acerto</p>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                                <div className="text-2xl font-bold text-gray-900">
                                    {stats.total}
                                </div>
                                <div className="text-sm text-gray-600">Total</div>
                            </div>
                            <div className="text-center p-4 bg-success-50 rounded-lg">
                                <div className="text-2xl font-bold text-success-700">
                                    {stats.correct}
                                </div>
                                <div className="text-sm text-success-700">Certas</div>
                            </div>
                            <div className="text-center p-4 bg-error-50 rounded-lg">
                                <div className="text-2xl font-bold text-error-700">
                                    {stats.incorrect}
                                </div>
                                <div className="text-sm text-error-700">Erradas</div>
                            </div>
                            <div className="text-center p-4 bg-gray-100 rounded-lg">
                                <div className="text-2xl font-bold text-gray-700">
                                    {stats.unanswered}
                                </div>
                                <div className="text-sm text-gray-600">Não respondidas</div>
                            </div>
                        </div>

                        {attempt.completed_at && (
                            <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-center gap-2 text-sm text-gray-600">
                                <Clock className="w-4 h-4" />
                                Finalizado em{' '}
                                {new Date(attempt.completed_at).toLocaleString('pt-BR')}
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filter === 'all'
                            ? 'bg-primary-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Todas ({stats.total})
                    </button>
                    <button
                        onClick={() => setFilter('correct')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filter === 'correct'
                            ? 'bg-success-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Certas ({stats.correct})
                    </button>
                    <button
                        onClick={() => setFilter('incorrect')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filter === 'incorrect'
                            ? 'bg-error-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Erradas ({stats.incorrect})
                    </button>
                    <button
                        onClick={() => setFilter('unanswered')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filter === 'unanswered'
                            ? 'bg-gray-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Não respondidas ({stats.unanswered})
                    </button>
                </div>

                {/* Questions List */}
                <div className="space-y-3">
                    {filteredQuestions.map((question, idx) => {
                        const realIndex = MOCK_QUESTIONS.indexOf(question);
                        const answer = answers[realIndex];
                        const status = getQuestionStatus(realIndex);
                        const isExpanded = expandedQuestion === realIndex;

                        return (
                            <Card key={question.id}>
                                <CardBody className="p-0">
                                    {/* Question Header */}
                                    <button
                                        onClick={() =>
                                            setExpandedQuestion(isExpanded ? null : realIndex)
                                        }
                                        className="w-full p-5 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="flex-shrink-0">
                                                {status === 'correct' && (
                                                    <CheckCircle2 className="w-6 h-6 text-success-600" />
                                                )}
                                                {status === 'incorrect' && (
                                                    <XCircle className="w-6 h-6 text-error-600" />
                                                )}
                                                {status === 'unanswered' && (
                                                    <AlertCircle className="w-6 h-6 text-gray-400" />
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-900">
                                                        Questão {realIndex + 1}
                                                    </span>
                                                    {answer?.choice && question.correctOption && (
                                                        <Badge
                                                            variant={
                                                                answer.choice === question.correctOption
                                                                    ? 'success'
                                                                    : 'error'
                                                            }
                                                            className="text-xs"
                                                        >
                                                            {answer.choice === question.correctOption
                                                                ? `✓ ${answer.choice}`
                                                                : `✗ ${answer.choice} → ${question.correctOption}`}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 line-clamp-1">
                                                    {question.stem}
                                                </p>
                                            </div>
                                        </div>

                                        {isExpanded ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                        )}
                                    </button>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="px-5 pb-5 border-t border-gray-100">
                                            {/* Question Stem */}
                                            <div className="p-4 bg-gray-50 rounded-lg my-4">
                                                <p className="text-gray-900">{question.stem}</p>
                                            </div>

                                            {/* Options */}
                                            <div className="space-y-2 mb-4">
                                                {Object.entries(question.options).map(([key, text]) => {
                                                    const isUserAnswer = answer?.choice === key;
                                                    const isCorrectAnswer = question.correctOption === key;

                                                    return (
                                                        <div
                                                            key={key}
                                                            className={`p-3 rounded-lg border-2 ${isCorrectAnswer
                                                                ? 'border-success-500 bg-success-50'
                                                                : isUserAnswer
                                                                    ? 'border-error-500 bg-error-50'
                                                                    : 'border-gray-200'
                                                                }`}
                                                        >
                                                            <div className="flex items-start gap-2">
                                                                <span className="font-bold text-gray-900 flex-shrink-0">
                                                                    {key})
                                                                </span>
                                                                <span className="text-gray-900 flex-1">{text}</span>
                                                                <div className="flex gap-1 flex-shrink-0">
                                                                    {isUserAnswer && (
                                                                        <Badge
                                                                            variant={isCorrectAnswer ? 'success' : 'error'}
                                                                            className="text-xs"
                                                                        >
                                                                            Sua resposta
                                                                        </Badge>
                                                                    )}
                                                                    {isCorrectAnswer && (
                                                                        <Badge variant="success" className="text-xs">
                                                                            Correta
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Explanation */}
                                            {question.explanation && (
                                                <div className="p-4 bg-primary-50 border-2 border-primary-200 rounded-lg">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                            <AlertCircle className="w-5 h-5 text-white" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="font-bold text-gray-900 mb-2">
                                                                Explicação
                                                            </h4>
                                                            <p className="text-sm text-gray-700 leading-relaxed">
                                                                {question.explanation}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {!question.explanation && (
                                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                                    <p className="text-sm text-gray-500">
                                                        Explicação não disponível para esta questão
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>

                {/* Bottom Actions */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Link href="/app/home" className="flex-1">
                        <Button variant="outline" className="w-full">
                            <Home className="w-4 h-4 mr-2" />
                            Voltar ao Início
                        </Button>
                    </Link>
                    <Link href="/app/monta-provas" className="flex-1">
                        <Button variant="primary" className="w-full">
                            Fazer Nova Prova
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
