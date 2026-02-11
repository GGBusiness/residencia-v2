'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Flag, LogOut } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmationModal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { getQuizDataAction, saveAnswerAction, finishQuizAction } from '@/app/actions/quiz-actions';

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
    const { toast, error: toastError } = useToast();
    const attemptId = params.attemptId as string;

    const [attempt, setAttempt] = useState<Attempt | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map());
    const [loading, setLoading] = useState(true);
    const [showResults, setShowResults] = useState(false);
    const [startTime] = useState(Date.now());

    // Modals State
    const [showExitModal, setShowExitModal] = useState(false);
    const [showFinishModal, setShowFinishModal] = useState(false);

    // Timer Logic
    const [timeLeft, setTimeLeft] = useState<number | null>(null); // in seconds
    const [isPaused, setIsPaused] = useState(false);

    // FSRS State
    const [showFeedback, setShowFeedback] = useState(false);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        loadQuiz();
    }, [attemptId]);

    // Reset feedback when question changes
    useEffect(() => {
        setShowFeedback(false);
        setIsFlipped(false);
    }, [currentIndex]);

    // Timer Effects
    useEffect(() => {
        if (attempt?.config?.timer) {
            setTimeLeft(attempt.config.timer);
        }
    }, [attempt]);

    useEffect(() => {
        if (!attempt || showResults || isPaused) return;

        const interval = setInterval(() => {
            if (attempt.config?.timer) {
                // Countdown
                setTimeLeft((prev) => {
                    if (prev === null) return null;
                    if (prev <= 1) {
                        clearInterval(interval);
                        finishQuiz(true); // Auto finish
                        return 0;
                    }
                    return prev - 1;
                });
            } else {
                // Stopwatch
                setTimeLeft((prev) => (prev || 0) + 1);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [attempt, showResults, isPaused]);

    const loadQuiz = async () => {
        try {
            setLoading(true);
            const result = await getQuizDataAction(attemptId);

            if (!result.success || !result.data) {
                if (result.error === 'Attempt not found') {
                    alert('Prova não encontrada.');
                    router.push('/app/monta-provas');
                    return;
                }
                throw new Error(result.error || 'Failed to load');
            }

            setAttempt(result.data.attempt);
            setQuestions(result.data.questions);

            const answersMap = new Map();
            result.data.answers.forEach((ans: any) => {
                if (ans.question_id) {
                    answersMap.set(ans.question_id, {
                        question_id: ans.question_id,
                        user_answer: ans.user_answer,
                        flagged: ans.flagged
                    });
                }
            });
            setAnswers(answersMap);

        } catch (error) {
            console.error('Error loading quiz:', error);
            toastError('Erro ao carregar prova. Tente novamente.');
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

        // Show feedback immediately
        setShowFeedback(true);
        if (attempt?.config?.type === 'review') {
            setIsFlipped(true);
        }

        const isCorrect = answer === question.correct_answer;
        await saveAnswerAction(attemptId, question.id, answer, isCorrect, currentIndex);
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

            if (currentIndex < questions.length - 1) {
                setCurrentIndex(currentIndex + 1);
            } else {
                finishQuiz();
            }
        } catch (error) {
            console.error('Error submitting review:', error);
            toastError('Erro ao salvar revisão.');
        } finally {
            setReviewSubmitting(false);
        }
    };

    const formatTime = (seconds: number | null) => {
        if (seconds === null) return '--:--';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const finishQuiz = async (auto: any = false) => {
        // Handle event object if passed by click
        const isAuto = typeof auto === 'boolean' ? auto : false;

        // If manual finish (not auto), validation is handled by the modal before calling this
        // if (!isAuto && !confirm('Tem certeza que deseja finalizar a prova?')) return;

        const correctCount = questions.filter((q) => {
            const userAnswer = answers.get(q.id)?.user_answer;
            return userAnswer === q.correct_answer;
        }).length;

        const percentage = (correctCount / questions.length) * 100;

        let timeSpent = 0;
        if (attempt?.config?.timer && timeLeft !== null) {
            timeSpent = attempt.config.timer - timeLeft;
        } else {
            timeSpent = Math.floor((Date.now() - startTime) / 1000);
        }

        await finishQuizAction(attemptId, {
            correctCount,
            percentage,
            timeSpent
        });

        setShowResults(true);
    };

    // ... existing submitReview code ...

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

    // ... existing zero questions check ...
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
        // ... existing results UI ...
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

    const isReviewMode = attempt?.config?.type === 'review';

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10 transition-shadow hover:shadow-md">
                <div className="max-w-5xl mx-auto px-4 py-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                            <Button
                                onClick={() => setShowExitModal(true)}
                                variant="ghost"
                                size="sm"
                                className="text-gray-500 hover:text-red-600"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                <span className="hidden sm:inline">Sair</span>
                            </Button>

                            {/* Timer Display */}
                            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-bold text-lg shadow-inner ${attempt?.config?.timer && (timeLeft || 0) < 300
                                ? 'bg-red-100 text-red-600 animate-pulse'
                                : 'bg-gray-100 text-gray-700'
                                }`}>
                                <Clock className="w-4 h-4" />
                                {formatTime(timeLeft)}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                            <Badge variant="info" className="whitespace-nowrap">
                                ✅ {answeredCount}/{questions.length}
                            </Badge>
                            <Badge variant="default" className="whitespace-nowrap">
                                📍 Q{currentIndex + 1}
                            </Badge>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3 overflow-hidden">
                        <div
                            className="bg-primary-600 h-1.5 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Question */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <Card className={`transition-all duration-500 ${isReviewMode ? 'min-h-[400px]' : ''}`}>
                    <CardBody>
                        {/* Question Header */}
                        <div className="mb-6 pb-4 border-b border-gray-200">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <Badge variant="default">{currentQuestion.institution}</Badge>
                                <Badge variant="info">{currentQuestion.year}</Badge>
                                <Badge variant="success">{currentQuestion.area}</Badge>
                                {isReviewMode && (
                                    <Badge variant="warning" className="animate-pulse">FLASHCARD</Badge>
                                )}
                            </div>
                        </div>

                        {/* Question Text */}
                        <div className="mb-8">
                            <p className="text-xl text-gray-900 leading-relaxed font-medium whitespace-pre-wrap">
                                {currentQuestion.question_text}
                            </p>
                        </div>

                        {/* Flashcard Reveal Button */}
                        {isReviewMode && !isFlipped && (
                            <div className="py-12 text-center">
                                <Button
                                    onClick={() => setIsFlipped(true)}
                                    size="lg"
                                    className="px-8 py-6 text-lg shadow-xl hover:scale-105 transition-transform"
                                >
                                    🤔 Mostrar Resposta
                                </Button>
                            </div>
                        )}

                        {/* Options */}
                        <div className={`space-y-3 transition-opacity duration-300 ${isReviewMode && !isFlipped ? 'opacity-0 hidden' : 'opacity-100'}`}>
                            {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                                const optionKey = `option_${letter.toLowerCase()}` as keyof Question;
                                const optionText = currentQuestion[optionKey];
                                if (!optionText) return null;

                                const isSelected = currentAnswer?.user_answer === letter;
                                const isCorrect = currentQuestion.correct_answer === letter;

                                // Conditional styling
                                let borderClass = 'border-gray-200 hover:border-primary-300 hover:bg-gray-50';
                                let bgClass = 'bg-gray-200 text-gray-700';

                                if (showFeedback || (isReviewMode && isFlipped)) {
                                    if (isCorrect) {
                                        borderClass = 'border-green-500 bg-green-50 shadow-md ring-1 ring-green-500';
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
                                        onClick={() => !showFeedback && !isReviewMode && selectAnswer(letter)}
                                        disabled={showFeedback || isReviewMode}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${borderClass}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold ${bgClass}`}
                                            >
                                                {letter}
                                            </div>
                                            <span className="text-gray-900 flex-1 text-base">{optionText as string}</span>
                                            {(showFeedback || (isReviewMode && isFlipped)) && isCorrect && (
                                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Explanation & Review Buttons */}
                        {(showFeedback || (isReviewMode && isFlipped)) && (
                            <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-300">
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-6 shadow-sm">
                                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                                        <Clock className="w-5 h-5" />
                                        Explicação
                                    </h4>
                                    <p className="text-blue-800 whitespace-pre-wrap leading-relaxed">{currentQuestion.explanation}</p>
                                </div>

                                <div className="border-t border-gray-100 pt-6">
                                    <h4 className="text-center text-gray-700 font-medium mb-4">Como foi sua memória?</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <Button
                                            onClick={() => submitReview(1)}
                                            disabled={reviewSubmitting}
                                            className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 h-auto py-3 flex-col gap-1"
                                        >
                                            <span className="font-bold">Errei / Esqueci</span>
                                            <span className="text-xs opacity-75">&lt; 1 min</span>
                                        </Button>
                                        <Button
                                            onClick={() => submitReview(2)}
                                            disabled={reviewSubmitting}
                                            className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200 h-auto py-3 flex-col gap-1"
                                        >
                                            <span className="font-bold">Difícil</span>
                                            <span className="text-xs opacity-75">~ 2 dias</span>
                                        </Button>
                                        <Button
                                            onClick={() => submitReview(3)}
                                            disabled={reviewSubmitting}
                                            className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 h-auto py-3 flex-col gap-1"
                                        >
                                            <span className="font-bold">Bom</span>
                                            <span className="text-xs opacity-75">~ 4 dias</span>
                                        </Button>
                                        <Button
                                            onClick={() => submitReview(4)}
                                            disabled={reviewSubmitting}
                                            className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 h-auto py-3 flex-col gap-1"
                                        >
                                            <span className="font-bold">Fácil</span>
                                            <span className="text-xs opacity-75">~ 7 dias</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>

                {/* Navigation (Only show if NOT in review mode OR if flipped in review mode, usually Review Mode auto-advances on rating, but prev/next might be useful) */}
                {(!showFeedback && !isReviewMode) && (
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
                            <Button onClick={() => setShowFinishModal(true)} variant="success">
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

            {/* Modals */}
            <ConfirmationModal
                isOpen={showExitModal}
                onClose={() => setShowExitModal(false)}
                onConfirm={() => router.push('/app/monta-provas')}
                title="Sair da Prova"
                message="Tem certeza que deseja sair? Seu progresso atual será perdido."
                confirmText="Sair"
                variant="danger"
            />

            <ConfirmationModal
                isOpen={showFinishModal}
                onClose={() => setShowFinishModal(false)}
                onConfirm={() => finishQuiz()}
                title="Finalizar Prova"
                message="Tem certeza que deseja finalizar a prova? Você não poderá alterar suas respostas depois."
                confirmText="Finalizar"
                variant="primary"
            />
        </div>
    );
}
