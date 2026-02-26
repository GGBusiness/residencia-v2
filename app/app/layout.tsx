'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Sparkles, Calendar, Target, History, Repeat, Database } from 'lucide-react';
import { ChatWidget } from '@/components/ai/ChatWidget';
import { PWAInstallPrompt } from '@/components/ui/PWAInstallPrompt';
import { useUser } from '@/hooks/useUser';
import OneSignalProvider from '@/components/providers/OneSignalProvider';

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

        { id: 'historico', label: 'Histórico', icon: History, path: '/app/historico' },
    ];

    const { user, isOnboarded, loading } = useUser();

    useEffect(() => {
        if (!loading && user && !isOnboarded) {
            router.push('/onboarding');
        }
    }, [user, isOnboarded, loading, router]);

    return (
        <OneSignalProvider>
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

                    <div className="p-4 border-t border-slate-200 bg-slate-50">
                        <button
                            onClick={() => router.push('/app/perfil')}
                            className="w-full group relative overflow-hidden bg-white hover:bg-gradient-to-br hover:from-indigo-50 hover:to-white border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all duration-300 shadow-sm hover:shadow-md text-left"
                        >
                            {/* Decorative Top Bar */}
                            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_auto] animate-gradient"></div>

                            <div className="p-4 flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-white border-2 border-white shadow-sm flex items-center justify-center text-indigo-700 font-bold shrink-0 overflow-hidden">
                                        {user?.avatar_url ? (
                                            <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                        ) : user?.name ? (
                                            <span className="text-lg">{user.name.substring(0, 2).toUpperCase()}</span>
                                        ) : (
                                            <span className="text-lg">DR</span>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-[4px] tracking-wider uppercase">
                                            PRO
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium">MEDICAL ID</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                                        {user?.name || 'Doutor(a)'}
                                    </p>
                                    <p className="text-[11px] text-slate-500 truncate group-hover:text-indigo-600 transition-colors">
                                        Configurações da Conta
                                    </p>
                                </div>
                            </div>

                            {/* Holographic effect overlay on hover */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        </button>
                    </div>
                </aside>

                {/* Mobile Bottom Nav */}
                <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/60 z-50 pt-2 pb-6 px-2 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                    <nav className="flex justify-around items-end">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.path;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => router.push(item.path)}
                                    className={`flex flex-col items-center gap-1 min-w-[64px] transition-all duration-300 ${isActive ? 'text-indigo-600 scale-105 transform' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    <div className="relative">
                                        <Icon className={`w-6 h-6 transition-all duration-300 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
                                        {isActive && (
                                            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-600 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.5)] opacity-0"></span> /* Opcional: bolinha luminosa, mas omitida pra manter clean */
                                        )}
                                    </div>
                                    <span className={`text-[10px] tracking-wide transition-all duration-300 ${isActive ? 'font-bold' : 'font-medium'}`}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                        {/* Botão Perfil Mobile */}
                        <button
                            onClick={() => router.push('/app/perfil')}
                            className={`flex flex-col items-center gap-1 min-w-[64px] transition-all duration-300 ${pathname === '/app/perfil' ? 'text-indigo-600 scale-105 transform' : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center overflow-hidden border-2 transition-all duration-300 ${pathname === '/app/perfil' ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-300 bg-slate-100'}`}>
                                {user?.avatar_url ? (
                                    <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : user?.name ? (
                                    <span className={`text-[9px] font-bold ${pathname === '/app/perfil' ? 'text-indigo-700' : 'text-slate-500'}`}>{user.name.substring(0, 2).toUpperCase()}</span>
                                ) : (
                                    <span className={`text-[9px] font-bold ${pathname === '/app/perfil' ? 'text-indigo-700' : 'text-slate-500'}`}>DR</span>
                                )}
                            </div>
                            <span className={`text-[10px] tracking-wide transition-all duration-300 ${pathname === '/app/perfil' ? 'font-bold' : 'font-medium'}`}>
                                Perfil
                            </span>
                        </button>
                    </nav>
                </div>

                {/* Main Content */}
                <main className="flex-1 overflow-auto pb-24 lg:pb-0 lg:pl-72 bg-slate-50">
                    <div className="max-w-7xl mx-auto p-4 lg:p-8">
                        {children}
                    </div>
                    <ChatWidget />
                    <PWAInstallPrompt />
                </main>
            </div>
        </OneSignalProvider>
    );
}
