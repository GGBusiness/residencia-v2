'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, CheckCircle2, Circle, ExternalLink, Download } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { dataService, type Attempt, type Document } from '@/lib/data-service';
import { supabase } from '@/lib/supabase';

export default function ProvaPage() {
    const params = useParams();
    const router = useRouter();
    const attemptId = params.attemptId as string;

    const [attempt, setAttempt] = useState<Attempt | null>(null);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [completedDocs, setCompletedDocs] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadAttempt();
    }, [attemptId]);

    const loadAttempt = async () => {
        try {
            setLoading(true);

            // Buscar attempt
            const { data: attemptData, error: attemptError } = await supabase
                .from('attempts')
                .select('*')
                .eq('id', attemptId)
                .single();

            if (attemptError) throw attemptError;

            const fetchedAttempt = attemptData as Attempt;
            setAttempt(fetchedAttempt);

            // Buscar documentos
            const documentIds = fetchedAttempt.config?.documentIds || [];

            if (documentIds.length > 0) {
                const { data: docs, error: docsError } = await supabase
                    .from('documents')
                    .select('*')
                    .in('id', documentIds);

                if (docsError) throw docsError;
                setDocuments(docs as Document[]);
            }

            // Buscar progresso (documentos completados)
            const saved = localStorage.getItem(`attempt-${attemptId}-progress`);
            if (saved) {
                setCompletedDocs(new Set(JSON.parse(saved)));
            }

        } catch (err: any) {
            console.error('Error loading attempt:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleDocumentComplete = (documentId: string) => {
        const newCompleted = new Set(completedDocs);

        if (newCompleted.has(documentId)) {
            newCompleted.delete(documentId);
        } else {
            newCompleted.add(documentId);
        }

        setCompletedDocs(newCompleted);
        localStorage.setItem(`attempt-${attemptId}-progress`, JSON.stringify(Array.from(newCompleted)));
    };

    const openDocument = (documentId: string) => {
        router.push(`/app/viewer/${documentId}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando sua prova...</p>
                </div>
            </div>
        );
    }

    if (error || !attempt) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardBody className="p-6 text-center">
                        <p className="text-red-600 mb-4">❌ Erro ao carregar prova</p>
                        <p className="text-gray-600 mb-4">{error || 'Prova não encontrada'}</p>
                        <Button variant="primary" onClick={() => router.push('/app/monta-provas')}>
                            Voltar
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    const progress = documents.length > 0
        ? Math.round((completedDocs.size / documents.length) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6">
                    <Button
                        variant="outline"
                        onClick={() => router.push('/app')}
                        className="mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar ao Início
                    </Button>

                    <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Sua Prova Personalizada
                        </h1>
                        <p className="text-gray-600 mb-4">
                            {documents.length} {documents.length === 1 ? 'documento selecionado' : 'documentos selecionados'} pela IA
                        </p>

                        {/* Progress Bar */}
                        <div className="mb-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-2">
                                <span>Progresso</span>
                                <span>{completedDocs.size} de {documents.length} concluídos ({progress}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-gradient-to-r from-primary-600 to-purple-600 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Config Info */}
                        <div className="flex flex-wrap gap-2">
                            {attempt.config?.area && (
                                <Badge variant="info">
                                    {attempt.config.area}
                                </Badge>
                            )}
                            {attempt.config?.years && attempt.config.years.length > 0 && (
                                <Badge variant="success">
                                    {attempt.config.years.join(', ')}
                                </Badge>
                            )}
                            {attempt.config?.feedbackMode && (
                                <Badge variant={attempt.config.feedbackMode === 'PROVA' ? 'warning' : 'info'}>
                                    {attempt.config.feedbackMode === 'PROVA' ? 'Modo Prova' : 'Modo Estudo'}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Documents List */}
                <div className="space-y-4">
                    {documents.map((doc, index) => {
                        const isCompleted = completedDocs.has(doc.id);

                        return (
                            <Card key={doc.id} className={`${isCompleted ? 'bg-green-50 border-2 border-green-300' : ''}`}>
                                <CardBody className="p-6">
                                    <div className="flex items-start gap-4">
                                        {/* Checkbox */}
                                        <button
                                            onClick={() => toggleDocumentComplete(doc.id)}
                                            className="flex-shrink-0 mt-1"
                                        >
                                            {isCompleted ? (
                                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                                            ) : (
                                                <Circle className="w-6 h-6 text-gray-400 hover:text-primary-600 transition-colors" />
                                            )}
                                        </button>

                                        {/* Content */}
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-bold text-primary-600">
                                                            #{index + 1}
                                                        </span>
                                                        {isCompleted && (
                                                            <Badge variant="success">
                                                                Concluído
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                                                        {doc.title}
                                                    </h3>
                                                </div>
                                            </div>

                                            {/* Metadata */}
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {doc.year && (
                                                    <Badge variant="info">
                                                        {doc.year}
                                                    </Badge>
                                                )}
                                                {doc.institution && (
                                                    <Badge variant="success">
                                                        {doc.institution}
                                                    </Badge>
                                                )}
                                                {doc.area && (
                                                    <Badge variant="warning">
                                                        {doc.area}
                                                    </Badge>
                                                )}
                                                {doc.has_answer_key && (
                                                    <Badge variant="success">
                                                        ✓ Gabarito
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="primary"
                                                    onClick={() => openDocument(doc.id)}
                                                >
                                                    <FileText className="w-4 h-4 mr-2" />
                                                    Abrir PDF
                                                </Button>


                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        if (doc.pdf_url) window.open(doc.pdf_url, '_blank')
                                                    }}
                                                >
                                                    <ExternalLink className="w-4 h-4 mr-2" />
                                                    Nova Aba
                                                </Button>

                                                <a
                                                    href={doc.pdf_url || '#'}
                                                    download
                                                    className={`inline-flex items-center px-4 py-2 border-2 border-gray-300 rounded-lg hover:border-primary-500 hover:text-primary-600 transition-colors text-sm font-medium ${!doc.pdf_url ? 'pointer-events-none opacity-50' : ''}`}
                                                >
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Download
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>

                {/* Completion Message */}
                {progress === 100 && (
                    <Card className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300">
                        <CardBody className="p-6 text-center">
                            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                🎉 Parabéns! Prova Concluída!
                            </h3>
                            <p className="text-gray-600 mb-4">
                                Você completou todos os documentos desta prova.
                            </p>
                            <Button
                                variant="primary"
                                onClick={() => router.push('/app/monta-provas')}
                            >
                                Montar Nova Prova
                            </Button>
                        </CardBody>
                    </Card>
                )}
            </div>
        </div >
    );
}
