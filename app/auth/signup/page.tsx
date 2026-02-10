'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sparkles, Mail, Lock, User, Phone, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        age: '',
        password: '',
        confirmPassword: '',
    });

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validações
        if (!formData.name || !formData.email || !formData.password) {
            setError('Preencha todos os campos obrigatórios');
            setLoading(false);
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('As senhas não coincidem');
            setLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres');
            setLoading(false);
            return;
        }

        try {
            // 1. Criar conta no Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        phone: formData.phone,
                        age: formData.age,
                    },
                },
            });

            if (authError) throw authError;

            // 2. Salvar dados adicionais na tabela users (Via Server Action no DigitalOcean)
            if (authData.user) {
                // Import dinâmico da action para evitar erros de render no cliente se não for 'use server' explicitamente no arquivo
                const { createUserProfile } = await import('@/app/actions/auth');

                const result = await createUserProfile({
                    id: authData.user.id,
                    email: formData.email,
                    name: formData.name,
                    phone: formData.phone,
                    age: parseInt(formData.age) || undefined,
                });

                if (!result.success) {
                    console.error('Erro ao salvar perfil:', result.error);
                    // Não bloqueamos o fluxo, pois o usuário já foi criado no Auth.
                    // Apenas logamos o erro. Idealmente mostraria um toast.
                }
            }

            // Redirecionar para onboarding
            router.push('/app/onboarding');
        } catch (err: any) {
            setError(err.message || 'Erro ao criar conta');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-2xl">
                <CardBody className="p-8">
                    {/* Logo/Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                            Bem-vindo! 🎓
                        </h1>
                        <p className="text-gray-700">
                            Crie sua conta para começar a estudar
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                            <p className="text-red-700 text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSignup} className="space-y-4">
                        {/* Nome Completo */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">
                                Nome Completo *
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ex: Maria Silva"
                                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">
                                Email *
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="seu@email.com"
                                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>

                        {/* Telefone e Idade */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">
                                    Telefone
                                </label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="(11) 99999-9999"
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">
                                    Idade
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
                                    <input
                                        type="number"
                                        value={formData.age}
                                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                        placeholder="25"
                                        min="18"
                                        max="99"
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Senha */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">
                                Senha *
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Mínimo 6 caracteres"
                                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {/* Confirmar Senha */}
                        <div>
                            <label className="block text-sm font-bold text-gray-900 mb-2">
                                Confirmar Senha *
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
                                <input
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    placeholder="Digite a senha novamente"
                                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? 'Criando conta...' : 'Criar Conta'} 🚀
                        </Button>
                    </form>

                    {/* Login Link */}
                    <div className="mt-6 text-center">
                        <p className="text-gray-700">
                            Já tem uma conta?{' '}
                            <Link href="/auth/login" className="text-primary-600 font-bold hover:text-primary-700">
                                Fazer Login
                            </Link>
                        </p>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
