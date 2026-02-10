'use client';

import { useState } from 'react';
import { Upload, FileText, Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function ExtractorPage() {
    const [files, setFiles] = useState<File[]>([]);
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [currentFile, setCurrentFile] = useState<string>('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const processFiles = async () => {
        setProcessing(true);
        setResults([]);

        for (const file of files) {
            setCurrentFile(file.name);

            const formData = new FormData();
            formData.append('pdf', file);

            try {
                const response = await fetch('/api/extract-pdf', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();

                if (data.success) {
                    setResults(prev => [...prev, {
                        filename: file.name,
                        success: true,
                        ...data
                    }]);
                } else {
                    setResults(prev => [...prev, {
                        filename: file.name,
                        success: false,
                        error: data.error
                    }]);
                }
            } catch (error: any) {
                setResults(prev => [...prev, {
                    filename: file.name,
                    success: false,
                    error: error.message
                }]);
            }
        }

        setProcessing(false);
        setCurrentFile('');
    };

    const downloadSQL = (result: any) => {
        const blob = new Blob([result.sql], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadAllSQL = () => {
        const allSQL = results
            .filter(r => r.success)
            .map(r => r.sql)
            .join('\n\n');

        const blob = new Blob([allSQL], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'todas-questoes.sql';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        🤖 Extrator Inteligente de Questões
                    </h1>
                    <p className="text-gray-600">
                        Faça upload dos PDFs de provas médicas e extraia automaticamente todas as questões com IA
                    </p>
                </div>

                {/* Upload Area */}
                <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
                    <label className="block mb-4">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-indigo-500 transition-colors cursor-pointer">
                            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-lg font-medium text-gray-700 mb-2">
                                Clique para selecionar PDFs
                            </p>
                            <p className="text-sm text-gray-500">
                                Ou arraste e solte arquivos aqui
                            </p>
                            <input
                                type="file"
                                multiple
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>
                    </label>

                    {files.length > 0 && (
                        <div className="mt-6">
                            <h3 className="font-semibold text-gray-900 mb-3">
                                Arquivos selecionados ({files.length}):
                            </h3>
                            <div className="space-y-2 mb-6">
                                {files.map((file, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded">
                                        <FileText className="w-4 h-4" />
                                        {file.name}
                                        <span className="text-gray-400 ml-auto">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={processFiles}
                                disabled={processing}
                                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {processing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Processando {currentFile}...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-5 h-5" />
                                        Processar {files.length} arquivo(s)
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Results */}
                {results.length > 0 && (
                    <div className="bg-white rounded-lg shadow-lg p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">
                                Resultados
                            </h2>
                            {results.some(r => r.success) && (
                                <button
                                    onClick={downloadAllSQL}
                                    className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Baixar Tudo
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            {results.map((result, i) => (
                                <div
                                    key={i}
                                    className={`p-4 rounded-lg border-2 ${result.success
                                            ? 'border-green-200 bg-green-50'
                                            : 'border-red-200 bg-red-50'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {result.success ? (
                                            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                                        ) : (
                                            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                                        )}

                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900 mb-1">
                                                {result.filename}
                                            </h3>

                                            {result.success ? (
                                                <>
                                                    <p className="text-sm text-gray-600 mb-3">
                                                        ✅ {result.questionCount} questões extraídas
                                                        • {result.institution} {result.year}
                                                    </p>
                                                    <button
                                                        onClick={() => downloadSQL(result)}
                                                        className="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Baixar SQL
                                                    </button>
                                                </>
                                            ) : (
                                                <p className="text-sm text-red-600">
                                                    ❌ Erro: {result.error}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="font-semibold text-blue-900 mb-2">
                                📌 Próximo passo:
                            </h4>
                            <p className="text-sm text-blue-700">
                                1. Baixe os arquivos SQL gerados<br />
                                2. Abra o Supabase SQL Editor<br />
                                3. Execute cada arquivo SQL<br />
                                4. As questões estarão disponíveis no app!
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
