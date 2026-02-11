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
    const [loading, setLoading] = useState(true);

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
