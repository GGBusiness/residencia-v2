'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    getCurrentUserAction,
    getUserProfileAction,
    getUserGoalsAction
} from '@/app/actions/user-actions';
import type { User, UserProfile, UserGoals } from '@/lib/user-service';

export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [goals, setGoals] = useState<UserGoals | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Helper para data
            const circleDate = (d: string) => d || new Date().toISOString();

            // Timeout de 5 segundos
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout loading user')), 5000)
            );

            // 1. Obter usuário do Supabase Auth
            const { data: { user: sbUser } } = await supabase.auth.getUser();

            if (!sbUser) {
                setLoading(false);
                return;
            }

            // Tentar obter do Banco de Dados
            const result = await Promise.race([
                getCurrentUserAction(sbUser.id),
                timeoutPromise
            ]) as any;

            let finalUser = null;

            if (result.success && result.data) {
                // Usuário existe no banco
                finalUser = result.data;
            } else {
                // Usuário não existe no banco (ou erro), usar metadados do Auth (Fallback)
                console.log('User not found in DB, using Auth metadata');
                const meta = sbUser.user_metadata || {};
                finalUser = {
                    id: sbUser.id,
                    email: sbUser.email || '',
                    name: meta.full_name || meta.name || sbUser.email?.split('@')[0] || 'Doutor(a)',
                    onboarding_completed: false,
                    created_at: circleDate(sbUser.created_at),
                    last_login: new Date().toISOString()
                };

                // Tentar sincronizar/criar usuário no banco silenciosamente
                // (Para que na próxima vez ele exista)
                try {
                    // Importar dinamicamente para evitar erro de ciclo se houver
                    const { updateUserDataAction } = await import('@/app/actions/user-actions');
                    await updateUserDataAction(sbUser.id, { name: finalUser.name });
                } catch (err) {
                    console.warn('Background user sync failed', err);
                }
            }

            setUser(finalUser);

            // Carregar profile e goals em paralelo
            try {
                const [pResult, gResult] = await Promise.all([
                    getUserProfileAction(finalUser.id),
                    getUserGoalsAction(finalUser.id),
                ]);
                if (pResult.success && pResult.data) setProfile(pResult.data);
                if (gResult.success && gResult.data) setGoals(gResult.data);
            } catch (err) {
                console.warn('Could not load profile/goals:', err);
            }



        } catch (error) {
            console.error('Error loading user data:', error);
            setError(error instanceof Error ? error.message : 'Unknown error');
            // Não bloquear a aplicação - continuar sem dados do usuário
        } finally {
            setLoading(false);
        }
    };

    const getFirstName = () => {
        if (!user?.name) return '';
        return user.name.split(' ')[0];
    };

    return {
        user,
        profile,
        goals,
        loading,
        error,
        firstName: getFirstName(),
        isOnboarded: user?.onboarding_completed || false,
        refreshUser: loadUserData,
    };
}
