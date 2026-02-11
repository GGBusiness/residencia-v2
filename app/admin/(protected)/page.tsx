'use client';

import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Upload, DollarSign, Users, Database, FileText, TrendingUp, Clock, UserPlus } from 'lucide-react';
import { getAdminStatsAction, getAdminCostsAction, setupAdminSchemaAction } from '@/app/actions/admin-actions';
import { ingestPDFAction } from '@/app/actions/admin-ingest';
import { logoutAdminAction } from '@/app/actions/admin-auth';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'finance'>('overview');
    const [stats, setStats] = useState<any>(null);
    const [costs, setCosts] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Upload State
    const [uploading, setUploading] = useState(false);
    const [uploadMsg, setUploadMsg] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            const result = await getAdminStatsAction();
            if (result.success) {
                setStats(result.data);
            }
            setLoading(false);
        };
        fetchStats();
    }, []);

    // Fetch costs when tab changes
    useEffect(() => {
        if (activeTab === 'finance') {
            const fetchCosts = async () => {
                const result = await getAdminCostsAction();
                if (result.success) {
                    setCosts(result.data);
                }
            };
            fetchCosts();
        }
    }, [activeTab]);

    const handleSetupSchema = async () => {
        if (!confirm('Isso criará a tabela de logs se não existir. Continuar?')) return;
        const result = await setupAdminSchemaAction();
        alert(result.message || result.error);
    };

    const handleLogout = async () => {
        await logoutAdminAction();
        router.push('/admin/login');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        setUploading(true);
        setUploadMsg(`Processando ${file.name}... (Isso pode demorar uns 30s)`);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const result = await ingestPDFAction(formData);

            if (result.success) {
                setUploadMsg(`✅ Sucesso! ${result.count} questões importadas.`);
            } else {
                setUploadMsg(`❌ Erro: ${result.error}`);
            }
        } catch (error) {
            setUploadMsg('❌ Erro inesperado no upload.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-slate-500">Visão geral do sistema e controle de ingestão.</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={activeTab === 'overview' ? 'primary' : 'outline'}
                        onClick={() => setActiveTab('overview')}
                        className="gap-2"
                    >
                        <Activity className="w-4 h-4" /> Visão Geral
                    </Button>
                    <Button
                        variant={activeTab === 'content' ? 'primary' : 'outline'}
                        onClick={() => setActiveTab('content')}
                        className="gap-2"
                    >
                        <Upload className="w-4 h-4" /> Conteúdo (IA)
                    </Button>
                    <Button
                        variant={activeTab === 'finance' ? 'primary' : 'outline'}
                        onClick={() => setActiveTab('finance')}
                        className="gap-2"
                    >
                        <DollarSign className="w-4 h-4" /> Custos & API
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                        Sair
                    </Button>
                </div>
            </div>

            {/* TAB: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* KPI CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Card>
                            <CardBody className="p-6 flex items-center gap-4">
                                <div className="p-4 bg-blue-100 rounded-full text-blue-600">
                                    <Users className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Usuários Totais</p>
                                    <h3 className="text-2xl font-bold">
                                        {loading ? '...' : stats?.users?.total || 0}
                                    </h3>
                                    <div className="flex items-center text-xs text-green-600 mt-1">
                                        <UserPlus className="w-3 h-3 mr-1" />
                                        +{loading ? '...' : stats?.users?.newToday || 0} hoje
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardBody className="p-6 flex items-center gap-4">
                                <div className="p-4 bg-green-100 rounded-full text-green-600">
                                    <Activity className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Ativos (24h)</p>
                                    <h3 className="text-2xl font-bold">
                                        {loading ? '...' : stats?.activity?.attemptsToday || 0}
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1">Simulados iniciados</p>
                                </div>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardBody className="p-6 flex items-center gap-4">
                                <div className="p-4 bg-purple-100 rounded-full text-purple-600">
                                    <Database className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Banco de Questões</p>
                                    <h3 className="text-2xl font-bold">
                                        {loading ? '...' : stats?.content?.totalQuestions || 0}
                                    </h3>
                                </div>
                            </CardBody>
                        </Card>

                        <Card>
                            <CardBody className="p-6 flex items-center gap-4">
                                <div className="p-4 bg-orange-100 rounded-full text-orange-600">
                                    <Clock className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 font-medium">Tempo de Uso</p>
                                    <h3 className="text-2xl font-bold">--h</h3>
                                    <p className="text-xs text-gray-400 mt-1">Média por usuário</p>
                                </div>
                            </CardBody>
                        </Card>
                    </div>

                    {/* GRÁFICOS E DETALHES (Placeholder) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="h-64 flex items-center justify-center bg-slate-50 border-dashed">
                            <p className="text-slate-400">Gráfico de Novos Usuários (Em Breve)</p>
                        </Card>
                        <Card className="h-64 flex items-center justify-center bg-slate-50 border-dashed">
                            <p className="text-slate-400">Atividade por Horário (Em Breve)</p>
                        </Card>
                    </div>
                </div>
            )}

            {/* TAB: CONTENT */}
            {activeTab === 'content' && (
                <Card>
                    <CardHeader className="border-b bg-slate-50 p-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            Ingestão de Provas (PDF)
                        </h2>
                    </CardHeader>
                    <CardBody className="p-8 border-2 border-dashed border-slate-300 rounded-b-xl m-6 bg-slate-50 transition-colors">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="p-4 bg-white rounded-full shadow-sm">
                                <Upload className="w-10 h-10 text-slate-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-700">Selecione o PDF da Prova</h3>
                                <p className="text-slate-500 text-sm mt-1">
                                    Processamento automático com Claude 3 Haiku.<br />
                                    Extrai questões, gabarito e gera embeddings.
                                </p>
                            </div>

                            <label className="cursor-pointer inline-block">
                                <span className={`inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 px-4 py-2 text-base bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {uploading ? 'Processando (Aguarde)...' : 'Selecionar Arquivo'}
                                </span>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                />
                            </label>

                            {uploadMsg && (
                                <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${uploadMsg.includes('Sucesso') ? 'bg-green-100 text-green-700' :
                                    uploadMsg.includes('Erro') ? 'bg-red-100 text-red-700' :
                                        'bg-blue-100 text-blue-700'
                                    }`}>
                                    {uploadMsg}
                                </div>
                            )}
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* TAB: FINANCE */}
            {activeTab === 'finance' && (
                <Card>
                    <CardHeader className="border-b p-6 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                            Custos Operacionais (API)
                        </h2>
                        <Button variant="outline" size="sm" onClick={handleSetupSchema}>
                            ⚙️ Setup Database
                        </Button>
                    </CardHeader>
                    <CardBody className="p-6 space-y-6">
                        <div className="flex items-center justify-between p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                            <div>
                                <p className="text-sm text-emerald-600 font-medium uppercase tracking-wider">Custo Total (Estimado)</p>
                                <h3 className="text-4xl font-bold text-emerald-900">
                                    ${costs?.totalCost?.toFixed(4) || '0.0000'}
                                </h3>
                            </div>
                            <div className="p-4 bg-white rounded-full shadow-sm">
                                <DollarSign className="w-8 h-8 text-emerald-500" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-slate-800">Histórico de Chamadas</h3>
                            <div className="overflow-x-auto border rounded-xl">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                                        <tr>
                                            <th className="p-3">Data/Hora</th>
                                            <th className="p-3">Provider</th>
                                            <th className="p-3 text-right">Tokens In</th>
                                            <th className="p-3 text-right">Tokens Out</th>
                                            <th className="p-3 text-right">Custo ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {costs?.history?.map((log: any, i: number) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="p-3 text-slate-600">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${log.provider === 'openai' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {log.provider}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right text-slate-500">{log.tokens_input}</td>
                                                <td className="p-3 text-right text-slate-500">{log.tokens_output}</td>
                                                <td className="p-3 text-right font-mono font-medium text-slate-700">
                                                    ${Number(log.cost_usd).toFixed(5)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!costs?.history || costs.history.length === 0) && (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-slate-400">
                                                    Nenhum registro encontrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
