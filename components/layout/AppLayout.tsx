'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    FileText,
    Target,
    BookOpen,
    Sparkles,
    History,
    User,
    LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
    { name: 'Início', href: '/app/home', icon: Home },
    { name: 'Provas', href: '/app/provas', icon: FileText },
    { name: 'Simulados', href: '/app/simulados', icon: Target },
    { name: 'Aulas', href: '/app/aulas', icon: BookOpen },
    { name: 'Monta Provas', href: '/app/monta-provas', icon: Sparkles },
    { name: 'Planner', href: '/app/planner', icon: BookOpen }, // Adicionando Planner explicitamente se não tiver, ou apenas removendo Metas
    { name: 'Histórico', href: '/app/history', icon: History },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Desktop Sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
                <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
                    <div className="flex items-center flex-shrink-0 px-6 py-5 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">RM</span>
                            </div>
                            <span className="font-bold text-gray-900 text-lg">Residência</span>
                        </div>
                    </div>

                    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={cn(
                                        'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all',
                                        isActive
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                    )}
                                >
                                    <item.icon
                                        className={cn(
                                            'mr-3 h-5 w-5 flex-shrink-0',
                                            isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
                                        )}
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex-shrink-0 border-t border-gray-200 p-4">
                        <Link
                            href="/app/profile"
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all"
                        >
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                <User className="w-4 h-4 text-primary-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    Meu Perfil
                                </p>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Mobile Bottom Navigation */}
            <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50">
                <nav className="flex justify-around">
                    {navigation.slice(0, 5).map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    'flex flex-col items-center justify-center py-2 px-2 flex-1',
                                    isActive ? 'text-primary-700' : 'text-gray-600'
                                )}
                            >
                                <item.icon className="h-6 w-6" />
                                <span className="text-[10px] mt-1 font-medium">{item.name}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Main content */}
            <div className="lg:pl-64 flex flex-col min-h-screen">
                <main className="flex-1 pb-20 lg:pb-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
