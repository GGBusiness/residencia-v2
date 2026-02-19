'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import {
    getCurrentUserAction,
    getUserProfileAction,
    getUserGoalsAction
} from '@/app/actions/user-actions';
import type { User, UserProfile, UserGoals } from '@/lib/user-service';

// Context placeholder - we'll import it or define it to avoid cycle
// Actually, let's just make the hook aware of the global state if provided.

export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [goals, setGoals] = useState<UserGoals | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // [PERFORMANCE FIX] Singleton cache to prevent redundant fetches across components
        if ((window as any).__USER_DATA_CACHE__) {
            const cache = (window as any).__USER_DATA_CACHE__;
            setUser(cache.user);
            setProfile(cache.profile);
            setGoals(cache.goals);
            setLoading(false);
            return;
        }

        let isMounted = true;
        loadUserData(isMounted);

        return () => { isMounted = false; };
    }, []);

    const loadUserData = async (isMounted: boolean = true) => {
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
                    const { syncUserAction } = await import('@/app/actions/user-actions');
                    await syncUserAction(sbUser.id, finalUser.email, finalUser.name);
                } catch (err) {
                    console.warn('Background user sync failed', err);
                }
            }

            if (isMounted) setUser(finalUser);

            // Carregar profile e goals em paralelo
            try {
                const [pResult, gResult] = await Promise.all([
                    getUserProfileAction(finalUser.id),
                    getUserGoalsAction(finalUser.id),
                ]);

                const finalProfile = pResult.success ? (pResult.data || null) : null;
                const finalGoals = gResult.success ? (gResult.data || null) : null;

                if (isMounted) {
                    setProfile(finalProfile);
                    setGoals(finalGoals);

                    // [CACHE SET] Store for subsequent hook calls
                    (window as any).__USER_DATA_CACHE__ = {
                        user: finalUser,
                        profile: finalProfile,
                        goals: finalGoals
                    };
                }
            } catch (err) {
                console.warn('Could not load profile/goals:', err);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            if (isMounted) setError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
            if (isMounted) setLoading(false);
        }
    };

    const getFirstName = () => {
        if (!user?.name) return '';
        return user.name.split(' ')[0];
    };

    const refreshUser = () => {
        (window as any).__USER_DATA_CACHE__ = null;
        loadUserData();
    };

    return {
        user,
        profile,
        goals,
        loading,
        error,
        firstName: getFirstName(),
        isOnboarded: user?.onboarding_completed || false,
        refreshUser,
    };
}
