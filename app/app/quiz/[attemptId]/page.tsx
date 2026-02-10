'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Flag } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase';

interface Question {
    id: string;
    institution: string;
    year: number;
    area: string;
    subarea: string;
    difficulty: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    option_e: string | null;
    correct_answer: string;
    explanation: string;
}

interface Attempt {
    id: string;
    user_id: string;
    config: any;
    status: string;
    total_questions: number;
    started_at: string;
}

interface UserAnswer {
    question_id: string;
    user_answer: string | null;
    flagged: boolean;
}

export default function QuizPage() {
    const params = useParams();
    const router = useRouter();
    const attemptId = params.attemptId as string;

    const [attempt, setAttempt] = useState<Attempt | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map());
    const [loading, setLoading] = useState(true);
    const [showResults, setShowResults] = useState(false);
    const [startTime] = useState(Date.now());

    // New FSRS State
    const [showFeedback, setShowFeedback] = useState(false);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);

    useEffect(() => {
        loadQuiz();
    }, [attemptId]);

    // Reset feedback when question changes
    useEffect(() => {
        setShowFeedback(false);
    }, [currentIndex]);

    const loadQuiz = async () => {
        try {
            setLoading(true);

            // Buscar attempt
            const { data: attemptData, error: attemptError } = await supabase
                .from('attempts')
                .select('*')
                .eq('id', attemptId)
                .single();

            if (attemptError) throw attemptError;
            setAttempt(attemptData);

            // Buscar questões baseado na configuração
            const config = attemptData.config;
            let query = supabase.from('questions').select('*');

            // Filtrar por área
            if (config.area && config.area !== 'todas') {
                query = query.eq('area', config.area);
            }

            // Filtrar por instituição
            if (config.programs && config.programs.length > 0) {
                query = query.in('institution', config.programs);
            }

            // Filtrar por anos
            if (config.years && config.years.length > 0) {
                query = query.in('year', config.years);
            }

            // Filtrar por dificuldade
            if (config.difficulty && config.difficulty !== 'todas') {
                if (config.difficulty === 'Faca na caveira') {
                    query = query.ilike('difficulty', '%Dificil%');
                } else {
                    query = query.ilike('difficulty', `%${config.difficulty}%`);
                }
            }

            // Filtrar por IDs específicos (Para Revisão FSRS)
            if (config.specific_ids && config.specific_ids.length > 0) {
                query = query.in('id', config.specific_ids);
            }

            // Limitar quantidade
            if (!config.specific_ids) {
                query = query.limit(config.questionCount || 20);
            }

            const { data: questionsData, error: questionsError } = await query;
            setQuestions(questionsData || []); // Move setQuestions here to fix logic flow if needed, or keep existing flow


            if (questionsError) throw questionsError;
            setQuestions(questionsData || []);

            // Carregar respostas salvas
            const { data: savedAnswers } = await supabase
                .from('user_answers')
                .select('*')
                .eq('attempt_id', attemptId);

            if (savedAnswers) {
                const answersMap = new Map();
                savedAnswers.forEach((ans: any) => {
                    answersMap.set(ans.question_id, {
                        question_id: ans.question_id,
                        user_answer: ans.user_answer,
                        flagged: false,
                    });
                });
                setAnswers(answersMap);
            }

        } catch (error) {
            console.error('Error loading quiz:', error);
            alert('Erro ao carregar prova. Tente novamente.');
            router.push('/app/monta-provas');
        } finally {
            setLoading(false);
        }
    };

    const selectAnswer = async (answer: string) => {
        const question = questions[currentIndex];
        if (!question) return;

        const newAnswers = new Map(answers);
        newAnswers.set(question.id, {
            question_id: question.id,
            user_answer: answer,
            flagged: answers.get(question.id)?.flagged || false,
        });
        setAnswers(newAnswers);

        // Show feedback immediately (FSRS / Study Mode)
        setShowFeedback(true);

        // Salvar no banco
        const isCorrect = answer === question.correct_answer;
        await supabase.from('user_answers').upsert({
            attempt_id: attemptId,
            question_id: question.id,
            user_answer: answer,
            is_correct: isCorrect,
        });
    };

    const finishQuiz = async () => {
        if (!confirm('Tem certeza que deseja finalizar a prova?')) return;

        const correctCount = questions.filter((q) => {
            const userAnswer = answers.get(q.id)?.user_answer;
            return userAnswer === q.correct_answer;
        }).length;

        const percentage = (correctCount / questions.length) * 100;
        const timeSpent = Math.floor((Date.now() - startTime) / 1000);

        await supabase
            .from('attempts')
            .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                correct_answers: correctCount,
                percentage: percentage.toFixed(2),
                time_spent_seconds: timeSpent,
            })
            .eq('id', attemptId);

        setShowResults(true);
    };

    const submitReview = async (rating: 1 | 2 | 3 | 4) => {
        const question = questions[currentIndex];
        try {
            setReviewSubmitting(true);
            await fetch('/api/study/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId: question.id, rating })
            });

            // Auto advance
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(currentIndex + 1);
            } else {
                finishQuiz();
            }
        } catch (error) {
            console.error('Error submitting review:', error);
            alert('Erro ao salvar revisão.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando prova...</p>
                </div>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50">
                <Card className="max-w-md">
                    <CardBody>
                        <p className="text-center text-gray-600 mb-4">
                            Nenhuma questão encontrada para esta configuração.
                        </p>
                        <Button onClick={() => router.push('/app/monta-provas')} fullWidth>
                            Voltar
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    if (showResults) {
        const correctCount = questions.filter((q) => {
            const userAnswer = answers.get(q.id)?.user_answer;
            return userAnswer === q.correct_answer;
        }).length;
        const percentage = (correctCount / questions.length) * 100;

        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 p-4">
                <Card className="max-w-2xl w-full">
                    <CardBody>
                        <div className="text-center">
                            <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto mb-4" />
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Prova Finalizada!</h2>

                            <div className="my-8 p-6 bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg">
                                <div className="text-5xl font-bold text-primary-600 mb-2">
                                    {percentage.toFixed(1)}%
                                </div>
                                <p className="text-gray-600">
                                    {correctCount} acertos de {questions.length} questões
                                </p>
                            </div>

                            <div className="space-y-3 mb-6">
                                <Button onClick={() => router.push('/app/historico')} fullWidth>
                                    Ver Histórico
                                </Button>
                                <Button onClick={() => router.push('/app/monta-provas')} variant="outline" fullWidth>
                                    Fazer Outra Prova
                                </Button>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
        );
    }

    const currentQuestion = questions[currentIndex];
    const currentAnswer = answers.get(currentQuestion.id);
    const progress = ((currentIndex + 1) / questions.length) * 100;
    const answeredCount = Array.from(answers.values()).filter(a => a.user_answer !== null).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-3">
                        <Button
                            onClick={() => router.push('/app/monta-provas')}
                            variant="ghost"
                            size="sm"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Sair
                        </Button>

                        <div className="flex items-center gap-4">
                            <Badge variant="info">
                                {answeredCount}/{questions.length} respondidas
                            </Badge>
                            <Badge variant="default">
                                Questão {currentIndex + 1}/{questions.length}
                            </Badge>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Question */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <Card>
                    <CardBody>
                        {/* Question Header */}
                        <div className="mb-6 pb-4 border-b border-gray-200">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <Badge variant="default">{currentQuestion.institution}</Badge>
                                <Badge variant="info">{currentQuestion.year}</Badge>
                                <Badge variant="success">{currentQuestion.area}</Badge>
                                {currentQuestion.difficulty && (
                                    <Badge variant="warning">{currentQuestion.difficulty}</Badge>
                                )}
                                {currentQuestion.subarea && (
                                    <Badge>{currentQuestion.subarea}</Badge>
                                )}
                            </div>
                        </div>

                        {/* Question Text */}
                        <div className="mb-6">
                            <p className="text-lg text-gray-900 leading-relaxed whitespace-pre-wrap">
                                {currentQuestion.question_text}
                            </p>
                        </div>

                        {/* Options */}
                        <div className="space-y-3">
                            {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                                const optionKey = `option_${letter.toLowerCase()}` as keyof Question;
                                const optionText = currentQuestion[optionKey];
                                if (!optionText) return null;

                                const isSelected = currentAnswer?.user_answer === letter;
                                const isCorrect = currentQuestion.correct_answer === letter;

                                // Conditional styling
                                let borderClass = 'border-gray-200 hover:border-primary-300 hover:bg-gray-50';
                                let bgClass = 'bg-gray-200 text-gray-700';

                                if (showFeedback) {
                                    if (isCorrect) {
                                        borderClass = 'border-green-500 bg-green-50';
                                        bgClass = 'bg-green-600 text-white';
                                    } else if (isSelected && !isCorrect) {
                                        borderClass = 'border-red-500 bg-red-50';
                                        bgClass = 'bg-red-600 text-white';
                                    } else if (isSelected) {
                                        borderClass = 'border-primary-500 bg-primary-50';
                                    }
                                } else {
                                    if (isSelected) {
                                        borderClass = 'border-primary-500 bg-primary-50';
                                        bgClass = 'bg-primary-600 text-white';
                                    }
                                }

                                return (
                                    <button
                                        key={letter}
                                        onClick={() => !showFeedback && selectAnswer(letter)}
                                        disabled={showFeedback}
                                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${borderClass}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${bgClass}`}
                                            >
                                                {letter}
                                            </div>
                                            <span className="text-gray-900 flex-1">{optionText as string}</span>
                                            {showFeedback && isCorrect && (
                                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Explanation & Review Buttons */}
                        {showFeedback && (
                            <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 mb-6">
                                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                                        <Clock className="w-5 h-5" />
                                        Explicação
                                    </h4>
                                    <p className="text-blue-800 whitespace-pre-wrap">{currentQuestion.explanation}</p>
                                </div>

                                <div className="border-t pt-6">
                                    <h4 className="text-center text-gray-700 font-medium mb-4">Como foi para você?</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <Button
                                            onClick={() => submitReview(1)}
                                            disabled={reviewSubmitting}
                                            className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                                        >
                                            Errei / Esqueci
                                            <span className="block text-xs opacity-75">&lt; 1 min</span>
                                        </Button>
                                        <Button
                                            onClick={() => submitReview(2)}
                                            disabled={reviewSubmitting}
                                            className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200"
                                        >
                                            Difícil
                                            <span className="block text-xs opacity-75">~ 2 dias</span>
                                        </Button>
                                        <Button
                                            onClick={() => submitReview(3)}
                                            disabled={reviewSubmitting}
                                            className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200"
                                        >
                                            Bom
                                            <span className="block text-xs opacity-75">~ 4 dias</span>
                                        </Button>
                                        <Button
                                            onClick={() => submitReview(4)}
                                            disabled={reviewSubmitting}
                                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200"
                                        >
                                            Fácil
                                            <span className="block text-xs opacity-75">~ 7 dias</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Navigation */}
                {!showFeedback && (
                    <div className="mt-6 flex items-center justify-between gap-4">
                        <Button
                            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                            disabled={currentIndex === 0}
                            variant="outline"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Anterior
                        </Button>

                        {currentIndex === questions.length - 1 ? (
                            <Button onClick={finishQuiz} variant="success">
                                Finalizar Prova
                                <CheckCircle2 className="w-4 h-4 ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={() => setCurrentIndex(currentIndex + 1)}>
                                Pular / Próxima
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
