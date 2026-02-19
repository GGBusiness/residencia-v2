'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink, Clock } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDocument, type Document } from '@/lib/data-service';
import { logStudyTimeAction } from '@/app/actions/study-time-actions';
import { useUser } from '@/hooks/useUser';
import Link from 'next/link';

export default function ViewerPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useUser();
    const docId = params.docId as string;

    const [document, setDocument] = useState<Document | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Timer tracking
    const startTimeRef = useRef<number>(Date.now());
    const loggedRef = useRef(false);

    useEffect(() => {
        const loadDocument = async () => {
            try {
                setLoading(true);
                const doc = await getDocument(docId);
                setDocument(doc);
            } catch (err) {
                console.error('Error loading document:', err);
                setError('Erro ao carregar documento');
            } finally {
                setLoading(false);
            }
        };

        if (docId) {
            loadDocument();
        }
    }, [docId]);

    // Logging function
    const logTime = useCallback(async () => {
        if (loggedRef.current || !user?.id) return;
        const durationMs = Date.now() - startTimeRef.current;
        const durationSec = Math.round(durationMs / 1000);
        if (durationSec < 15) return; // Ignore very short visits
        loggedRef.current = true;

        try {
            await logStudyTimeAction(
                user.id,
                'revisao',
                durationSec,
                { docId, title: document?.title, area: document?.area, institution: document?.institution }
            );
            console.log(`📄 [Viewer] Logged ${durationSec}s of review time.`);
        } catch (e) {
            console.error('[Viewer] Failed to log time:', e);
        }
    }, [user?.id, document, docId]);

    // Live timer tick
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedTime(Math.round((Date.now() - startTimeRef.current) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Log on unmount / route change
    useEffect(() => {
        return () => { logTime(); };
    }, [logTime]);

    // Log on page close/tab close via beacon
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (loggedRef.current || !user?.id) return;
            const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
            if (durationSec < 15) return;
            loggedRef.current = true;
            navigator.sendBeacon('/api/log-study-time', JSON.stringify({
                userId: user.id,
                activityType: 'revisao',
                durationSeconds: durationSec,
                metadata: { docId, title: document?.title, area: document?.area }
            }));
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [user?.id, document, docId]);

    // Format timer display
    const formatTimer = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando documento...</p>
                </div>
            </div>
        );
    }

    if (error || !document) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardBody className="p-8 text-center">
                        <p className="text-red-600 mb-4">{error || 'Documento não encontrado'}</p>
                        <Button onClick={() => router.back()}>
                            Voltar
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    if (!document.pdf_url) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardBody className="p-8 text-center">
                        <p className="text-gray-600 mb-4">
                            Este documento não possui arquivo PDF associado
                        </p>
                        <Button onClick={() => router.back()}>
                            Voltar
                        </Button>
                    </CardBody>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.back()}
                            className="flex-shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar
                        </Button>

                        <div className="min-w-0 flex-1">
                            <h1 className="text-white font-bold text-lg truncate">
                                {document.title}
                            </h1>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {document.year && (
                                    <Badge variant="default" className="text-xs">
                                        {document.year}
                                    </Badge>
                                )}
                                {document.institution && (
                                    <Badge variant="default" className="text-xs">
                                        {document.institution}
                                    </Badge>
                                )}
                                {document.area && (
                                    <Badge variant="default" className="text-xs">
                                        {document.area}
                                    </Badge>
                                )}
                                {document.has_answer_key && (
                                    <Badge variant="success" className="text-xs">
                                        Com Gabarito
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Live Timer */}
                        <div className="flex items-center gap-1.5 bg-gray-700 px-3 py-1.5 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <Clock className="w-3.5 h-3.5 text-gray-300" />
                            <span className="text-sm font-mono text-gray-200">{formatTimer(elapsedTime)}</span>
                        </div>
                        <a
                            href={document.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden sm:block"
                        >
                            <Button variant="outline" size="sm">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Abrir em Nova Aba
                            </Button>
                        </a>
                        <a
                            href={document.pdf_url}
                            download
                        >
                            <Button variant="primary" size="sm">
                                <Download className="w-4 h-4 mr-2" />
                                Download
                            </Button>
                        </a>
                    </div>
                </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 relative">
                <iframe
                    src={`${document.pdf_url}#view=FitH`}
                    className="absolute inset-0 w-full h-full border-0"
                    title={document.title}
                />
            </div>

            {/* Mobile Actions */}
            <div className="sm:hidden bg-gray-800 border-t border-gray-700 px-4 py-3">
                <div className="flex gap-2">
                    <a
                        href={document.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                    >
                        <Button variant="outline" size="sm" className="w-full">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Abrir
                        </Button>
                    </a>
                    <Link href={`/app/monta-provas?doc=${document.id}`} className="flex-1">
                        <Button variant="primary" size="sm" className="w-full">
                            Usar na Prova
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
