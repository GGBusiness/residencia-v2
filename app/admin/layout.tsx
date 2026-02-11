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

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

    if (!user || user.email !== adminEmail) {
        console.warn(`Unauthorized access attempt to /admin by ${user?.email}`);
        redirect('/app');
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
