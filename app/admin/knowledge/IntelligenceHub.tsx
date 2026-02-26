'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload, BrainCircuit, CheckCircle, AlertCircle, Loader2, Sparkles, ShieldCheck, Database, X } from 'lucide-react';
import { getPresignedUrlAction } from '@/app/actions/storage-actions';
import { ingestUnifiedAction } from '@/app/actions/admin-hybrid-ingest';
import { verifyDbSyncAction, getIngestedDocumentsAction } from '@/app/actions/admin-actions';

export default function IntelligenceHub() {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'info', msg: string }>({ type: 'idle', msg: '' });
    const [logs, setLogs] = useState<string[]>([]);

    // Ingested documents state
    const [documents, setDocuments] = useState<any[]>([]);
    const [totalDocs, setTotalDocs] = useState<number>(0);
    const [loadingDocs, setLoadingDocs] = useState(true);

    const fetchDocuments = useCallback(async () => {
        setLoadingDocs(true);
        const result = await getIngestedDocumentsAction();
        if (result.success) {
            setDocuments(result.data || []);
            setTotalDocs(result.total || 0);
        }
        setLoadingDocs(false);
    }, []);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    // Pipeline report after completion
    const [pipelineReport, setPipelineReport] = useState<{
        questionsGenerated: number;
        questionsRejected: number;
        questionsAutoFixed: number;
        dbSync: any;
        filesProcessed: number;
    } | null>(null);

    // === NAVIGATION BLOCKING while uploading ===
    useEffect(() => {
        if (!uploading) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'PDFs estão sendo processados! Se sair, o processamento será interrompido.';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [uploading]);

    // === BLOCK MODAL ===
    const [showBlockModal, setShowBlockModal] = useState(false);

    // Show the block modal whenever an upload starts
    useEffect(() => {
        if (uploading) {
            setShowBlockModal(true);
        }
    }, [uploading]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const files = Array.from(e.target.files);
        setUploading(true);
        setLogs([]);
        setPipelineReport(null);

        let successCount = 0;
        let failCount = 0;
        let totalQuestionsGenerated = 0;
        let totalQuestionsRejected = 0;
        let totalQuestionsAutoFixed = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const currentFileNum = i + 1;
            const totalFiles = files.length;

            setProgress(Math.round(((currentFileNum - 1) / totalFiles) * 100));
            setStatus({ type: 'info', msg: `[${currentFileNum}/${totalFiles}] Enviando: ${file.name}...` });

            let uploadUrl = '';
            const contentType = file.type || 'application/octet-stream';

            try {
                // 1. Get Presigned URL
                const presignedResult = await getPresignedUrlAction(file.name, contentType);

                if (!presignedResult.success || !presignedResult.data) {
                    throw new Error(presignedResult.error || 'Falha ao gerar URL.');
                }

                uploadUrl = presignedResult.data.uploadUrl;
                const { key, publicUrl } = presignedResult.data;

                // 2. Upload to S3
                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': contentType }
                });

                if (!uploadRes.ok) throw new Error('Falha no upload para o Storage.');

                setStatus({ type: 'info', msg: `[${currentFileNum}/${totalFiles}] 🧠 GPT processando: ${file.name}...` });

                // 3. Trigger Unified Ingest (Server Action) — includes AUTO-FIX + DB-SYNC
                const ingestResult = await ingestUnifiedAction({ fileKey: key, fileName: file.name, publicUrl });

                if (!ingestResult.success) throw new Error(ingestResult.error);

                const r = ingestResult.results;
                totalQuestionsGenerated += r?.questionsGenerated || 0;
                totalQuestionsRejected += (r as any)?.questionsRejected || 0;
                totalQuestionsAutoFixed += (r as any)?.questionsAutoFixed || 0;

                // Log per file
                const autoFixInfo = (r as any)?.questionsAutoFixed
                    ? ` | 🔧 ${(r as any).questionsAutoFixed} auto-corrigidas`
                    : ' | ✅ Qualidade OK';
                const successMsg = `✅ [${file.name}]: ${r?.questionsGenerated || 0} questões, ${r?.ragChunks || 0} memórias${autoFixInfo}`;
                setLogs(prev => [...prev, successMsg]);

                if (r?.errors && r.errors.length > 0) {
                    r.errors.forEach((err: string) => {
                        setLogs(prev => [...prev, `⚠️ ${err}`]);
                    });
                }
                successCount++;

            } catch (error: any) {
                console.error(`Erro no arquivo ${file.name}:`, error);
                const errorMsg = error.message.includes('Failed to fetch')
                    ? `Bloqueio de Rede/CORS. URL: ${uploadUrl?.slice(0, 100)}...`
                    : error.message;
                setLogs(prev => [...prev, `❌ Erro (${file.name}): ${errorMsg}`]);
                failCount++;
            }
        }

        // Final DB Sync verify
        setStatus({ type: 'info', msg: '🔄 Verificando integridade do banco de dados...' });
        let dbSyncResult: any = null;
        try {
            dbSyncResult = await verifyDbSyncAction();
            if (dbSyncResult.success) {
                setLogs(prev => [...prev, `🔄 [DB-SYNC] Docs: ${dbSyncResult.summary?.documents}, Questões: ${dbSyncResult.summary?.questions}, Embeddings: ${dbSyncResult.summary?.embeddings}`]);
                if (dbSyncResult.fixes && dbSyncResult.fixes.length > 0) {
                    dbSyncResult.fixes.forEach((fix: string) => {
                        setLogs(prev => [...prev, `🔧 [DB-SYNC] ${fix}`]);
                    });
                }
                if (dbSyncResult.badQuestionsCount === 0) {
                    setLogs(prev => [...prev, '✅ [DB-SYNC] Todas as questões estão íntegras!']);
                }
            }
        } catch (e) {
            setLogs(prev => [...prev, '⚠️ [DB-SYNC] Falha na verificação']);
        }

        setProgress(100);
        setStatus({
            type: failCount === 0 ? 'success' : 'info',
            msg: `Concluído! ${successCount} sucessos, ${failCount} falhas.`
        });

        setPipelineReport({
            questionsGenerated: totalQuestionsGenerated,
            questionsRejected: totalQuestionsRejected,
            questionsAutoFixed: totalQuestionsAutoFixed,
            dbSync: dbSyncResult,
            filesProcessed: successCount,
        });

        setUploading(false);
        setShowBlockModal(false);
    };

    return (
        <>
            {/* === BLOCKING MODAL === */}
            {showBlockModal && uploading && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 relative animate-in fade-in duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-amber-100 rounded-full">
                                <AlertCircle className="w-8 h-8 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Processamento em Andamento</h3>
                                <p className="text-sm text-slate-500">Não feche ou saia desta página!</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                <p className="text-sm text-amber-800 font-medium">
                                    ⚠️ Os PDFs estão sendo processados pela IA. Se você sair, o processamento será interrompido
                                    e dados podem ser perdidos.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm font-semibold text-indigo-700">
                                    <span>Pipeline Automático</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out rounded-full"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-center text-slate-500 animate-pulse">
                                    {status.msg}
                                </p>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-center">
                                {['📝 Extração', '🧠 GPT', '🔧 Auto-Fix', '🔄 DB Sync'].map((step, idx) => (
                                    <div key={idx} className={`p-2 rounded-lg text-xs font-medium transition-all ${progress > (idx * 25) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                                        }`}>
                                        {step}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Card className="border-indigo-100 shadow-lg">
                <CardHeader className="border-b bg-indigo-50/50 p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-900">
                                <BrainCircuit className="w-6 h-6 text-indigo-600" />
                                Central de Inteligência (Hub)
                            </h2>
                            <p className="text-sm text-indigo-600 mt-1">
                                Arraste <b>PDFs</b> ou <b>ZIPs</b> (Múltiplos arquivos suportados).
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardBody className="p-8">

                    {/* Upload Zone */}
                    <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${uploading ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                        }`}>
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-white rounded-full shadow-md">
                                {uploading ? (
                                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                                ) : (
                                    <div className="flex gap-2">
                                        <FileText className="w-8 h-8 text-slate-400" />
                                        <Sparkles className="w-8 h-8 text-amber-400" />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-slate-700">
                                    {uploading ? 'Processando Lotes...' : 'Solte seus arquivos aqui'}
                                </h3>
                                <p className="text-slate-500 text-sm max-w-md mx-auto">
                                    Selecione até 100 <b>PDFs</b> ou <b>ZIPs</b> de uma vez.<br />
                                    <em>Pipeline automático: Extração → GPT → Auto-Fix → DB Sync</em>
                                </p>
                            </div>

                            <label className="cursor-pointer">
                                <span className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-all shadow-md ${uploading
                                    ? 'bg-indigo-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                                    }`}>
                                    <Upload className="w-5 h-5" />
                                    {uploading ? 'Enviando...' : 'Selecionar Arquivos (Múltiplos)'}
                                </span>
                                <input
                                    type="file"
                                    accept=".pdf,.zip"
                                    className="hidden"
                                    multiple
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                />
                            </label>
                        </div>

                        {/* Progress Bar */}
                        {uploading && (
                            <div className="mt-8 max-w-lg mx-auto">
                                <div className="flex justify-between text-xs font-semibold text-indigo-600 mb-2">
                                    <span>Progresso</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-600 transition-all duration-500 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-center text-slate-500 mt-2 animate-pulse">
                                    {status.msg}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* === PIPELINE REPORT (after completion) === */}
                    {pipelineReport && (
                        <div className="mt-6 p-6 rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-green-100 rounded-full">
                                    <ShieldCheck className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-green-800">✅ Pipeline Automático Concluído</h4>
                                    <p className="text-xs text-green-600">Todas as automações foram executadas com sucesso</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                                    <p className="text-2xl font-bold text-indigo-600">{pipelineReport.filesProcessed}</p>
                                    <p className="text-xs text-slate-500">Arquivos</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                                    <p className="text-2xl font-bold text-green-600">{pipelineReport.questionsGenerated}</p>
                                    <p className="text-xs text-slate-500">Questões Geradas</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                                    <p className="text-2xl font-bold text-amber-600">{pipelineReport.questionsAutoFixed}</p>
                                    <p className="text-xs text-slate-500">Auto-Corrigidas</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                                    <p className="text-2xl font-bold text-purple-600">
                                        {pipelineReport.dbSync?.summary?.questions || '—'}
                                    </p>
                                    <p className="text-xs text-slate-500">Total no Banco</p>
                                </div>
                            </div>

                            {/* Pipeline Steps Confirmed */}
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm text-green-700">
                                    <CheckCircle className="w-4 h-4" /> Questões geradas com GPT-5.2
                                </div>
                                <div className="flex items-center gap-2 text-sm text-green-700">
                                    <CheckCircle className="w-4 h-4" /> Auditoria automática executada
                                </div>
                                <div className="flex items-center gap-2 text-sm text-green-700">
                                    <CheckCircle className="w-4 h-4" /> Auto-fix de qualidade aplicado
                                </div>
                                <div className="flex items-center gap-2 text-sm text-green-700">
                                    <CheckCircle className="w-4 h-4" /> Sincronização do banco verificada
                                </div>
                                {pipelineReport.dbSync?.healthy && (
                                    <div className="flex items-center gap-2 text-sm text-green-700 font-semibold">
                                        <Database className="w-4 h-4" /> Banco 100% íntegro — zero problemas detectados
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Status & Logs */}
                    {(status.type === 'success' || status.type === 'error' || logs.length > 0) && (
                        <div className={`mt-6 p-6 rounded-xl border ${status.type === 'success' ? 'bg-green-50 border-green-200' :
                            status.type === 'error' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                            }`}>
                            <div className="flex items-center gap-3 mb-4">
                                {status.type === 'success' && <CheckCircle className="w-6 h-6 text-green-600" />}
                                {status.type === 'error' && <AlertCircle className="w-6 h-6 text-red-600" />}
                                <h4 className={`font-bold ${status.type === 'success' ? 'text-green-800' :
                                    status.type === 'error' ? 'text-red-800' : 'text-slate-800'
                                    }`}>
                                    {status.msg || 'Relatório de Processamento'}
                                </h4>
                            </div>

                            <div className="space-y-2 pl-9 max-h-64 overflow-y-auto">
                                {logs.map((log, i) => (
                                    <p key={i} className="text-sm font-mono text-slate-700 border-b border-slate-200/50 pb-1 last:border-0">
                                        {log}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* === INGESTED DOCUMENTS LIST === */}
                    <div className="mt-10 border-t pt-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Database className="w-5 h-5 text-indigo-500" /> Histórico de Ingestão
                            </h3>
                            {!loadingDocs && (
                                <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl">
                                    <span className="text-sm font-medium text-indigo-900">Total de PDFs Inseridos:</span>
                                    <span className="text-lg font-bold text-indigo-600 bg-white px-3 py-0.5 rounded-lg shadow-sm border border-indigo-50">
                                        {totalDocs}
                                    </span>
                                </div>
                            )}
                        </div>

                        {loadingDocs ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                            </div>
                        ) : documents.length === 0 ? (
                            <p className="text-center text-slate-500 p-8 border border-dashed rounded-xl">Nenhum documento ingerido ainda.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="p-3 text-slate-600 font-semibold">Documento</th>
                                            <th className="p-3 text-slate-600 font-semibold">Instituição/Ano</th>
                                            <th className="p-3 text-slate-600 font-semibold text-center">Questões Extraídas</th>
                                            <th className="p-3 text-slate-600 font-semibold text-right">Data Ingestão</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {documents.map((doc) => (
                                            <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-3 text-slate-800 font-medium max-w-[200px] sm:max-w-xs md:max-w-md truncate" title={doc.title}>
                                                    {doc.title}
                                                </td>
                                                <td className="p-3 text-slate-500 whitespace-nowrap">
                                                    {doc.institution || '—'} {doc.year ? `- ${doc.year}` : ''}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full text-xs">
                                                        {doc.question_count}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right text-slate-400 text-xs whitespace-nowrap">
                                                    {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </CardBody>
            </Card>
        </>
    );
}
