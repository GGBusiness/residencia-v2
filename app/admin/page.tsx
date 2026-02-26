'use client';

import { useState, useEffect } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Upload, DollarSign, Users, Database, FileText, TrendingUp, Clock, UserPlus, BrainCircuit } from 'lucide-react';
import { getAdminStatsAction, getAdminCostsAction, setupAdminSchemaAction } from '@/app/actions/admin-actions';
import { logoutAdminAction } from '@/app/actions/admin-auth';
import { useRouter } from 'next/navigation';
import IntelligenceHub from './knowledge/IntelligenceHub';

export default function AdminDashboard() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'overview' | 'intelligence' | 'finance'>('overview');
    const [stats, setStats] = useState<any>(null);
    const [costs, setCosts] = useState<any>(null);
    const [infra, setInfra] = useState<any>(null);
    const [pushHistory, setPushHistory] = useState<any>(null);
    const [pushStats, setPushStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshingInfra, setRefreshingInfra] = useState(false);

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

    const fetchInfraData = async () => {
        setRefreshingInfra(true);
        const { getInfrastructureMetricsAction } = await import('@/app/actions/admin-actions');
        const result = await getInfrastructureMetricsAction();
        if (result.success) {
            setInfra(result.data);
        }
        setRefreshingInfra(false);
    };

    // Fetch costs when tab changes
    useEffect(() => {
        if (activeTab === 'finance') {
            const fetchFinanceData = async () => {
                const costsResult = await getAdminCostsAction();
                if (costsResult.success) {
                    setCosts(costsResult.data);
                }

                const { getPushHistoryAction, getOneSignalStatsAction } = await import('@/app/actions/admin-actions');
                const histRes = await getPushHistoryAction();
                if (histRes.success) {
                    setPushHistory(histRes.data);
                }

                const onesignalRes = await getOneSignalStatsAction();
                if (onesignalRes.success) {
                    setPushStats(onesignalRes.data);
                }
            };
            fetchFinanceData();
            fetchInfraData();
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
                        variant={activeTab === 'intelligence' ? 'primary' : 'outline'}
                        onClick={() => setActiveTab('intelligence')}
                        className="gap-2"
                    >
                        <BrainCircuit className="w-4 h-4" /> Central de Inteligência
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
                                    {!loading && stats?.content?.aiQuestions !== undefined && (
                                        <p className="text-xs text-purple-500 mt-1">
                                            🤖 {stats.content.aiQuestions} geradas por IA
                                        </p>
                                    )}
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

                    {/* ANALYTICS WIDGETS */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Top Institutions */}
                        <Card>
                            <CardHeader className="p-4 border-b font-semibold text-slate-700 bg-slate-50">
                                Instituições Mais Buscadas
                            </CardHeader>
                            <CardBody className="p-0">
                                {stats?.analytics?.topInstitutions?.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between p-3 border-b last:border-0 hover:bg-slate-50">
                                        <span className="text-sm font-medium text-slate-600">{i + 1}. {item.name || 'N/A'}</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                            {item.usage_count} provas
                                        </span>
                                    </div>
                                ))}
                                {(!stats?.analytics?.topInstitutions?.length) && (
                                    <p className="p-4 text-center text-slate-400 text-sm">Sem dados suficientes.</p>
                                )}
                            </CardBody>
                        </Card>

                        {/* Top Areas */}
                        <Card>
                            <CardHeader className="p-4 border-b font-semibold text-slate-700 bg-slate-50">
                                Áreas Mais Praticadas
                            </CardHeader>
                            <CardBody className="p-0">
                                {stats?.analytics?.topAreas?.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between p-3 border-b last:border-0 hover:bg-slate-50">
                                        <span className="text-sm font-medium text-slate-600 truncate max-w-[180px]" title={item.area}>
                                            {item.area || 'Geral'}
                                        </span>
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                            {item.count} questões
                                        </span>
                                    </div>
                                ))}
                                {(!stats?.analytics?.topAreas?.length) && (
                                    <p className="p-4 text-center text-slate-400 text-sm">Sem dados suficientes.</p>
                                )}
                            </CardBody>
                        </Card>

                        {/* Top Specialties */}
                        <Card>
                            <CardHeader className="p-4 border-b font-semibold text-slate-700 bg-slate-50">
                                Especialidades Alvo (Users)
                            </CardHeader>
                            <CardBody className="p-0">
                                {stats?.analytics?.topSpecialties?.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between p-3 border-b last:border-0 hover:bg-slate-50">
                                        <span className="text-sm font-medium text-slate-600 truncate max-w-[180px]">
                                            {item.specialty || 'Não informado'}
                                        </span>
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                            {item.count} usuários
                                        </span>
                                    </div>
                                ))}
                                {(!stats?.analytics?.topSpecialties?.length) && (
                                    <p className="p-4 text-center text-slate-400 text-sm">Sem dados suficientes.</p>
                                )}
                            </CardBody>
                        </Card>
                    </div>
                </div>
            )}

            {/* TAB: UNIFIED INTELLIGENCE HUB */}
            {activeTab === 'intelligence' && (
                <IntelligenceHub />
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
                        {/* INFRASTRUCTURE METRICS ROW */}
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-slate-800">Infraestrutura & APIs em Tempo Real</h3>
                            <Button variant="outline" size="sm" onClick={fetchInfraData} disabled={refreshingInfra}>
                                {refreshingInfra ? 'Atualizando...' : '🔄 Atualizar Agora'}
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* OpenAI */}
                            <div className={`flex flex-col p-6 rounded-xl border shadow-sm relative overflow-hidden ${infra?.openai_status === 'quota_exceeded' ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <BrainCircuit className={`w-16 h-16 ${infra?.openai_status === 'quota_exceeded' ? 'text-red-900' : 'text-slate-900'}`} />
                                </div>
                                <div className="z-10">
                                    <p className={`text-sm font-medium uppercase tracking-wider mb-1 ${infra?.openai_status === 'quota_exceeded' ? 'text-red-700' : 'text-slate-500'}`}>OpenAI (IA API)</p>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-3 h-3 rounded-full ${infra?.openai_status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : infra?.openai_status === 'quota_exceeded' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-amber-500 animate-pulse'}`}></div>
                                        <span className={`font-bold ${infra?.openai_status === 'active' ? 'text-emerald-700' : infra?.openai_status === 'quota_exceeded' ? 'text-red-700' : 'text-amber-700'}`}>
                                            {infra?.openai_status === 'active' ? 'Sistema Operacional' : infra?.openai_status === 'quota_exceeded' ? 'Sem Saldo (Erro 429)' : 'Verificando...'}
                                        </span>
                                    </div>
                                    <p className={`text-xs mt-2 ${infra?.openai_status === 'quota_exceeded' ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                                        Gasto Acumulado: <b>${infra?.openai_spent?.toFixed(4) || '0.0000'}</b>
                                    </p>
                                </div>
                            </div>

                            {/* DigitalOcean - DB */}
                            <div className="flex flex-col p-6 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <Database className="w-24 h-24 text-blue-900" />
                                </div>
                                <div className="z-10">
                                    <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Cérebro App (Postgres)</p>
                                    <h3 className="text-3xl font-bold text-slate-800">
                                        {infra?.database_size || '0 MB'}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-2">Uso bruto do servidor (DigitalOcean)</p>
                                </div>
                            </div>

                            {/* Supabase Storage */}
                            <div className="flex flex-col p-6 bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <Upload className="w-24 h-24 text-emerald-900" />
                                </div>
                                <div className="z-10">
                                    <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Storage Nuvem (Supabase)</p>
                                    <h3 className="text-3xl font-bold text-slate-800">
                                        {infra?.storage_size || '0.00 MB'}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-2">Tamanho total dos arquivos sincronizados</p>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-slate-200 w-full my-6"></div>

                        {/* MANUAL PUSH SENDER */}
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-slate-800 flex items-center gap-2">
                                <span className="text-xl">📢</span> Transmissão Manual (Push)
                            </h3>
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 mb-8">
                                <p className="text-sm text-indigo-800 mb-4">
                                    Envie um alerta instantâneo para o celular de todos os alunos que ativaram as notificações.
                                </p>
                                <form action={async (formData) => {
                                    const title = formData.get('title') as string;
                                    const message = formData.get('message') as string;
                                    const { sendManualPushNotificationAction } = await import('@/app/actions/admin-actions');
                                    const res = await sendManualPushNotificationAction(title, message);
                                    if (res.success) {
                                        alert('✅ ' + res.message);
                                        // Auto-refresh the history after sending
                                        const { getPushHistoryAction } = await import('@/app/actions/admin-actions');
                                        const histRes = await getPushHistoryAction();
                                        if (histRes.success) setPushHistory(histRes.data);
                                    } else {
                                        alert('❌ Erro: ' + res.error);
                                    }
                                }} className="space-y-4">
                                    <div>
                                        <input
                                            name="title"
                                            required
                                            placeholder="Título (ex: 📚 Novo Simulado Disponível!)"
                                            className="w-full p-3 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <textarea
                                            name="message"
                                            required
                                            placeholder="Mensagem (ex: As provas da USP 2024 já estão na plataforma. Venha conferir!)"
                                            rows={2}
                                            className="w-full p-3 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                                        />
                                    </div>
                                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                                        Enviar Transmissão Global
                                    </Button>
                                </form>
                            </div>

                            {/* PUSH NOTIFICATIONS HISTORY FEED */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                    <span className="text-xl">🕰️</span> Histórico de Disparos
                                </h3>
                                {/* Estatísticas Rápidas do OneSignal */}
                                {pushStats && (
                                    <div className="flex gap-4 text-sm bg-slate-50 px-4 py-2 rounded-lg border">
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 text-xs">Total Enviados</span>
                                            <span className="font-bold text-slate-700">{pushStats.total_sent} alertas</span>
                                        </div>
                                        <div className="w-px bg-slate-200"></div>
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 text-xs">Assinantes Ativos</span>
                                            <span className="font-bold text-indigo-600 truncate max-w-[150px]" title={pushStats.subscribers}>{pushStats.subscribers}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                                        <tr>
                                            <th className="p-3">Data/Hora</th>
                                            <th className="p-3">Título</th>
                                            <th className="p-3">Mensagem</th>
                                            <th className="p-3 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {pushHistory?.map((log: any, i: number) => (
                                            <tr key={log.id || i} className="hover:bg-slate-50">
                                                <td className="p-3 text-slate-500 whitespace-nowrap">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="p-3 font-medium text-slate-700">
                                                    {log.title}
                                                </td>
                                                <td className="p-3 text-slate-600 max-w-sm truncate" title={log.message}>
                                                    {log.message}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                        onClick={async () => {
                                                            if (!confirm('Deseja REENVIAR esta notificação globalmente agora?')) return;
                                                            const { sendManualPushNotificationAction, getPushHistoryAction } = await import('@/app/actions/admin-actions');
                                                            const res = await sendManualPushNotificationAction(log.title, log.message);
                                                            if (res.success) {
                                                                alert('✅ ' + res.message);
                                                                const histRes = await getPushHistoryAction();
                                                                if (histRes.success) setPushHistory(histRes.data);
                                                            } else {
                                                                alert('❌ Erro: ' + res.error);
                                                            }
                                                        }}
                                                    >
                                                        Reenviar
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!pushHistory || pushHistory.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="p-8 text-center text-slate-400">
                                                    Nenhum histórico de notificação encontrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="h-px bg-slate-200 w-full my-6"></div>

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
