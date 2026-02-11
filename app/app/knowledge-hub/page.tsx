'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, Brain, Database } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ingestKnowledgeFile } from '@/lib/data-service';

export default function KnowledgeHub() {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setStatus('idle');
            setMessage('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus('uploading');
        setMessage('Enviando para o servidor...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            setStatus('processing');
            setMessage('Dr. IA está analisando o conteúdo e gerando aprendizado...');

            const result = await ingestKnowledgeFile(formData);

            if (result.success) {
                setStatus('success');
                setMessage(`Sucesso! O Dr. IA estudou o arquivo "${file.name}" e agora pode responder perguntas sobre ele.`);
                setFile(null);
            }
        } catch (error) {
            console.error(error);
            setStatus('error');
            setMessage('Ocorreu um erro ao processar o arquivo. Verifique se é um PDF válido.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
                        <Database className="text-white w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Hub de Conhecimento</h1>
                        <p className="text-gray-600">Alimente o App e o Dr. IA diretamente na DigitalOcean</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <Card className="border-2 border-dashed border-gray-200 bg-white/50 backdrop-blur-sm">
                        <CardBody className="p-12 text-center">
                            <div className="flex flex-col items-center">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-colors ${status === 'success' ? 'bg-green-100 text-green-600' :
                                        status === 'error' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
                                    }`}>
                                    {status === 'idle' && <Upload className="w-10 h-10" />}
                                    {(status === 'uploading' || status === 'processing') && <Loader2 className="w-10 h-10 animate-spin" />}
                                    {status === 'success' && <CheckCircle2 className="w-10 h-10" />}
                                    {status === 'error' && <AlertCircle className="w-10 h-10" />}
                                </div>

                                <h2 className="text-xl font-bold text-gray-900 mb-2">
                                    {status === 'idle' ? 'Adicionar Novo Material' : 'Processando Material'}
                                </h2>
                                <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                                    Suba PDFs de revisões, diretrizes ou matérias. O Dr. IA irá estudar esse conteúdo instantaneamente.
                                </p>

                                <div className="w-full max-w-md">
                                    {status === 'idle' && (
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept=".pdf"
                                                onChange={handleFileChange}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div className={`p-4 border-2 border-dashed rounded-xl transition-all ${file ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200 hover:border-indigo-300'
                                                }`}>
                                                {file ? (
                                                    <div className="flex items-center justify-center gap-2 text-indigo-600 font-medium">
                                                        <FileText className="w-5 h-5" />
                                                        {file.name}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">Clique ou arraste um PDF aqui</span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {message && (
                                        <div className={`mt-4 p-4 rounded-xl text-sm font-medium ${status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                                                status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                                                    'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                            }`}>
                                            {message}
                                        </div>
                                    )}

                                    <div className="mt-8 flex gap-3">
                                        <Button
                                            variant="primary"
                                            className="flex-1 py-6 text-lg"
                                            disabled={!file || status === 'uploading' || status === 'processing'}
                                            onClick={handleUpload}
                                        >
                                            {status === 'processing' ? 'Estudando conteúdo...' : 'Alimentar Dr. IA'}
                                        </Button>
                                    </div>

                                    {status === 'success' && (
                                        <Button
                                            variant="outline"
                                            className="w-full mt-3"
                                            onClick={() => setStatus('idle')}
                                        >
                                            Subir outro arquivo
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none">
                            <CardBody className="p-6">
                                <div className="flex items-start gap-3">
                                    <Brain className="w-8 h-8 opacity-80" />
                                    <div>
                                        <h3 className="font-bold text-lg">Inteligência Vetorial</h3>
                                        <p className="text-sm text-indigo-100 mt-1">
                                            Seu conteúdo é transformado em vetores matemáticos (Embeddings) para busca semântica ultrarrápida.
                                        </p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                        <Card className="bg-gradient-to-br from-indigo-800 to-indigo-950 text-white border-none">
                            <CardBody className="p-6">
                                <div className="flex items-start gap-3">
                                    <Database className="w-8 h-8 opacity-80" />
                                    <div>
                                        <h3 className="font-bold text-lg">DigitalOcean Cloud</h3>
                                        <p className="text-sm text-indigo-200 mt-1">
                                            Os dados são persistidos diretamente na sua infraestrutura de produção, sem intermediários.
                                        </p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
