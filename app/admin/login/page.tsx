'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShieldAlert, KeyRound, Loader2 } from 'lucide-react';
import { loginAdminAction } from '@/app/actions/admin-auth';

export default function AdminLoginPage() {
    const router = useRouter();
    const [key, setKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await loginAdminAction(key);
            if (result.success) {
                router.refresh(); // Refresh router cache
                router.push('/admin'); // Redirect to dashboard
            } else {
                setError(result.error || 'Chave inválida');
            }
        } catch (err) {
            setError('Erro ao tentar login. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-600">
                        <ShieldAlert className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Acesso Admin</h1>
                    <p className="text-slate-400 text-sm">Insira a chave de segurança para continuar.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Chave de Acesso
                        </label>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-3.5 h-5 w-5 text-slate-500" />
                            <input
                                type="password"
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                placeholder="SUP3R-S3CR3T-KEY..."
                                autoFocus
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm font-medium text-center">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6 rounded-xl transition-all hover:scale-[1.02]"
                        disabled={loading || !key}
                    >
                        {loading ? (
                            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verificando...</>
                        ) : (
                            'Liberar Acesso'
                        )}
                    </Button>
                </form>

                <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                    <p className="text-xs text-slate-500">
                        Sistema Restrito • Residência Médica App
                    </p>
                </div>
            </div>
        </div>
    );
}
