'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Sparkles, Calendar, Target, History, Repeat, Database } from 'lucide-react';
import { ChatWidget } from '@/components/ai/ChatWidget';

export default function AppRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const menuItems = [
        { id: 'inicio', label: 'Início', icon: Home, path: '/app' },
        { id: 'revisoes', label: 'Revisões', icon: Repeat, path: '/app/revisoes' },
        { id: 'monta-provas', label: 'Monta Provas', icon: Sparkles, path: '/app/monta-provas' },
        { id: 'planner', label: 'Planner', icon: Calendar, path: '/app/planner' },
        { id: 'metas', label: 'Metas', icon: Target, path: '/app/metas' },
        { id: 'historico', label: 'Histórico', icon: History, path: '/app/historico' },
    ];

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Sidebar Moderno */}
            <aside className="w-72 bg-white/80 backdrop-blur-xl border-r border-slate-200 flex-shrink-0 hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 z-30 shadow-soft">
                <div className="p-8 flex-shrink-0">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
                            <span className="text-white font-bold text-lg">R</span>
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Residência<span className="text-indigo-600">.AI</span></h1>
                    </div>
                    <p className="text-xs text-slate-500 font-medium pl-11">Preparação de Alto Nível</p>
                </div>

                <nav className="flex-1 px-4 overflow-y-auto space-y-1">
                    <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-2">Menu Principal</p>
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.path ||
                            (item.path !== '/app' && pathname?.startsWith(item.path));

                        return (
                            <button
                                key={item.id}
                                onClick={() => router.push(item.path)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                <span>{item.label}</span>
                                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600"></div>}
                            </button>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                            {/* User Initials Placeholder */}
                            DR
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">Doutor(a)</p>
                            <p className="text-xs text-slate-500 truncate">Plano Premium</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Mobile Bottom Nav */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 z-50 pb-safe">
                <nav className="flex justify-around py-3">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.path;

                        return (
                            <button
                                key={item.id}
                                onClick={() => router.push(item.path)}
                                className={`flex flex-col items-center gap-1 ${isActive ? 'text-indigo-600' : 'text-slate-400'
                                    }`}
                            >
                                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-indigo-50' : 'bg-transparent'}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-auto pb-24 lg:pb-0 lg:pl-72 bg-slate-50">
                <div className="max-w-7xl mx-auto p-4 lg:p-8">
                    {children}
                </div>
                <ChatWidget />
            </main>
        </div>
    );
}
