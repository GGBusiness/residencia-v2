'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { userService, type User, type UserProfile, type UserGoals } from '@/lib/user-service';

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

            const userData = await Promise.race([
                userService.getCurrentUser(sbUser.id),
                timeoutPromise
            ]) as User | null;

            if (userData) {
                setUser(userData);

                // Carregar profile e goals em paralelo, mas não bloquear se falhar
                try {
                    const [profileData, goalsData] = await Promise.all([
                        userService.getUserProfile(userData.id),
                        userService.getUserGoals(userData.id),
                    ]);
                    setProfile(profileData);
                    setGoals(goalsData);
                } catch (err) {
                    console.warn('Could not load profile/goals:', err);
                    // Continuar mesmo sem profile/goals
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
    };
}
