'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { FileText, Upload, BrainCircuit, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getPresignedUrlAction } from '@/app/actions/storage-actions';
import { ingestKnowledgeAction } from '@/app/actions/admin-knowledge';

export default function KnowledgeBaseTab() {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<any>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setUploading(true);
        setStatus({ type: 'info', msg: 'Iniciando upload seguro para a Nuvem...' });
        setProgress(10);

        try {
            // 1. Obter URL pré-assinada (Server Action)
            const presigned = await getPresignedUrlAction(file.name, file.type);

            if (!presigned.success || !presigned.data) {
                throw new Error(presigned.error || 'Falha ao obter permissão de upload');
            }

            const { uploadUrl, publicUrl, key } = presigned.data;
            setProgress(30);
            setStatus({ type: 'info', msg: 'Enviando arquivo para DigitalOcean Spaces...' });

            // 2. Upload Direto (Client -> S3)
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type,
                    'x-amz-acl': 'public-read', // Importante se o bucket exigir
                },
            });

            if (!uploadResponse.ok) {
                throw new Error('Falha no upload para o Storage');
            }

            setProgress(60);
            setStatus({ type: 'info', msg: 'Arquivo salvo na nuvem! Iniciando treinamento da IA...' });

            // 3. Trigger Ingestão (Server Action)
            await ingestKnowledgeAction({ fileKey: key, fileName: file.name, publicUrl });

            setProgress(100);
            setStatus({ type: 'success', msg: 'Sucesso! O Dr. IA leu e aprendeu este conteúdo.' });

        } catch (error: any) {
            console.error(error);
            setStatus({ type: 'error', msg: error.message || 'Erro desconhecido' });
            setProgress(0);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="border-b bg-slate-50 p-6">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <BrainCircuit className="w-6 h-6 text-purple-600" />
                        Base de Conhecimento (Training)
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Ensine novos conteúdos ao Dr. IA. Arquivos são salvos na nuvem e indexados automaticamente.
                    </p>
                </CardHeader>

                <CardBody className="p-8">
                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-purple-200 bg-purple-50/50 rounded-xl p-10 text-center transition-colors hover:bg-purple-50">
                        <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 text-purple-500">
                            <Upload className="w-8 h-8" />
                        </div>

                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Upload de Material de Estudo</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                            Suporta <strong>PDF, ZIP, DOCX, TXT</strong>. <br />
                            Arquivos grandes são enviados diretamente para a DigitalOcean.
                        </p>

                        <label className="relative inline-flex">
                            <Button
                                disabled={uploading}
                                size="lg"
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-8 py-6 h-auto rounded-xl shadow-lg shadow-purple-200"
                            >
                                {uploading ? (
                                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processando...</>
                                ) : (
                                    'Selecionar Arquivo para Treino'
                                )}
                            </Button>
                            <input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                onChange={handleFileUpload}
                                disabled={uploading}
                                accept=".pdf,.zip,.docx,.txt"
                            />
                        </label>

                        {/* Progress Bar */}
                        {uploading && (
                            <div className="max-w-xs mx-auto mt-6">
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-purple-500 transition-all duration-300 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-purple-600 mt-2 font-medium animate-pulse">
                                    {progress}% - {status?.msg}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Status Message */}
                    {status && !uploading && (
                        <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
                            status.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
                                'bg-blue-100 text-blue-800'
                            }`}>
                            {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <span className="font-medium">{status.msg}</span>
                        </div>
                    )}
                </CardBody>
            </Card>

            {/* List of Knowledge (Placeholder) */}
            <Card>
                <CardHeader className="border-b p-6">
                    <h3 className="font-bold text-slate-800">Materiais Indexados</h3>
                </CardHeader>
                <CardBody className="p-0">
                    <div className="p-8 text-center text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>A lista de arquivos aparecerá aqui em breve.</p>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
