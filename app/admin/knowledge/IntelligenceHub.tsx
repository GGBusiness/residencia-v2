'use client';

import { useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { FileText, Upload, BrainCircuit, CheckCircle, AlertCircle, Loader2, Sparkles, FolderArchive } from 'lucide-react';
import { getPresignedUrlAction } from '@/app/actions/storage-actions';
import { ingestUnifiedAction } from '@/app/actions/admin-hybrid-ingest';

export default function IntelligenceHub() {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error' | 'info', msg: string }>({ type: 'idle', msg: '' });
    const [logs, setLogs] = useState<string[]>([]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setUploading(true);
        setProgress(10);
        setStatus({ type: 'info', msg: 'Iniciando upload seguro para a Nuvem...' });
        setLogs([]);

        try {
            // 1. Get Presigned URL
            const presignedResult = await getPresignedUrlAction(file.name, file.type);

            if (!presignedResult.success || !presignedResult.data) throw new Error(presignedResult.error || 'Falha ao gerar URL.');

            const { uploadUrl, key, publicUrl } = presignedResult.data;

            setProgress(30);
            setStatus({ type: 'info', msg: 'Enviando arquivo para DigitalOcean Spaces...' });

            // 2. Upload to S3 (Directly)
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type }
            });

            if (!uploadRes.ok) throw new Error('Falha no upload para o Storage.');

            setProgress(60);
            setStatus({ type: 'info', msg: 'Arquivo na nuvem! Iniciando Processamento Híbrido (IA + Banco)...' });

            // 3. Trigger Unified Ingest (Server Action)
            const ingestResult = await ingestUnifiedAction({ fileKey: key, fileName: file.name, publicUrl });

            if (!ingestResult.success) throw new Error(ingestResult.error);

            setProgress(100);
            setStatus({ type: 'success', msg: 'Processamento Concluído!' });

            // Format logs from result
            if (ingestResult.results) {
                const newLogs = [
                    `✅ ${ingestResult.results.processedFiles} arquivos processados.`,
                    `🧠 ${ingestResult.results.ragChunks} blocos de memória criados para a IA.`,
                    `📝 ${ingestResult.results.questionsGenerated} questões geradas/extraídas para o Banco.`
                ];
                if (ingestResult.results.errors.length > 0) {
                    newLogs.push('⚠️ Erros:', ...ingestResult.results.errors);
                }
                setLogs(newLogs);
            }

        } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', msg: error.message || 'Erro desconhecido.' });
            setLogs(prev => [...prev, `❌ Erro: ${error.message}`]);
        } finally {
            setUploading(false);
        }
    };

    return (
        <Card className="border-indigo-100 shadow-lg">
            <CardHeader className="border-b bg-indigo-50/50 p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-900">
                            <BrainCircuit className="w-6 h-6 text-indigo-600" />
                            Central de Inteligência (Hub)
                        </h2>
                        <p className="text-sm text-indigo-600 mt-1">
                            Arraste <b>PDFs</b> ou <b>ZIPs</b>. O sistema alimenta o Dr. IA e o Banco de Questões simultaneamente.
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
                                {uploading ? 'Processando...' : 'Solte seus arquivos aqui'}
                            </h3>
                            <p className="text-slate-500 text-sm max-w-md mx-auto">
                                Suporta <b>PDF</b> (Apostilas, Provas) e <b>ZIP</b> (Múltiplos arquivos).<br />
                                <em>O fluxo unificado extrai questões e treina a IA automaticamente.</em>
                            </p>
                        </div>

                        <label className="cursor-pointer">
                            <span className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-all shadow-md ${uploading
                                ? 'bg-indigo-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                                }`}>
                                <Upload className="w-5 h-5" />
                                {uploading ? 'Enviando...' : 'Selecionar Arquivos'}
                            </span>
                            <input
                                type="file"
                                accept=".pdf,.zip"
                                className="hidden"
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

                        <div className="space-y-2 pl-9">
                            {logs.map((log, i) => (
                                <p key={i} className="text-sm font-mono text-slate-700 border-b border-slate-200/50 pb-1 last:border-0">
                                    {log}
                                </p>
                            ))}
                        </div>
                    </div>
                )}

            </CardBody>
        </Card>
    );
}
