import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    // Fallback hardcoded para garantir acesso caso a ENV falhe na Vercel
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'henzio1@hotmail.com';

    const currentUserEmail = user?.email?.toLowerCase().trim();
    const allowedEmail = adminEmail?.toLowerCase().trim();

    if (!user || currentUserEmail !== allowedEmail) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-100 text-slate-800 font-sans">
                <div className="bg-white p-8 rounded-xl shadow-xl max-w-lg w-full text-center border border-slate-200">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>

                    <h1 className="text-2xl font-bold mb-2 text-slate-900">Acesso Restrito</h1>
                    <p className="text-slate-500 mb-6">Esta área é exclusiva para administradores.</p>

                    <div className="bg-slate-50 p-4 rounded-lg text-left text-sm font-mono border border-slate-200 mb-6 space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Logado como:</span>
                            <span className={user ? "text-slate-700 font-bold" : "text-red-500"}>
                                {user?.email || 'Não detectado (Null)'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Admin Requerido:</span>
                            <span className="text-slate-700 font-bold">{adminEmail}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t mt-2">
                            <span className="text-slate-400">Status:</span>
                            <span className="text-red-600 font-bold">Bloqueado (Mismatch)</span>
                        </div>
                    </div>

                    <a
                        href="/app"
                        className="inline-flex items-center justify-center w-full px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                    >
                        Voltar para o App
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="font-bold text-xl flex items-center gap-2">
                        🛡️ Centro de Comando
                        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 font-normal">v2.1</span>
                    </div>
                    <div className="text-sm text-slate-400">
                        {user.email}
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto p-6">
                {children}
            </main>
        </div>
    );
}
