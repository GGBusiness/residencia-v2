import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default function ProtectedAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_access_token');

    if (!token || token.value !== 'valid') {
        redirect('/admin/login');
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-slate-900 text-white p-4 sticky top-0 z-50 shadow-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="font-bold text-xl flex items-center gap-2">
                        🛡️ Centro de Comando
                        <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 font-normal">v3.0 (Secured)</span>
                    </div>
                    <div className="text-sm text-slate-400 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Admin Mode
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto p-6">
                {children}
            </main>
        </div>
    );
}
