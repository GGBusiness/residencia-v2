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

            const result = await Promise.race([
                getCurrentUserAction(sbUser.id),
                timeoutPromise
            ]) as any;

            if (result.success && result.data) {
                const userData = result.data;
                setUser(userData);

                // Carregar profile e goals em paralelo
                try {
                    const [pResult, gResult] = await Promise.all([
                        getUserProfileAction(userData.id),
                        getUserGoalsAction(userData.id),
                    ]);
                    if (pResult.success && pResult.data) setProfile(pResult.data);
                    if (gResult.success && gResult.data) setGoals(gResult.data);
                } catch (err) {
                    console.warn('Could not load profile/goals:', err);
                }
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
