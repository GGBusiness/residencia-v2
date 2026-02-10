import { supabase } from './supabase';

export interface User {
    id: string;
    email: string;
    name: string;
    onboarding_completed: boolean;
    created_at: string;
    last_login: string;
}

export interface UserProfile {
    id: string;
    user_id: string;
    target_institution: string;
    target_specialty: string;
    exam_date?: string;
    exam_timeframe: 'menos_3_meses' | '3_6_meses' | '6_12_meses' | 'mais_1_ano';
    weekly_hours: number;
    has_attempted_before: boolean;
    theoretical_base: 'fraca' | 'media' | 'boa' | 'excelente';
}

export interface UserGoals {
    id: string;
    user_id: string;
    daily_hours_goal: number;
    weekly_hours_goal: number;
    target_percentage: number;
    theory_percentage: number;
    practice_percentage: number;
    focus_area: string;
}

export interface OnboardingData {
    name: string;
    email: string;
    target_institution: string;
    target_specialty: string;
    exam_timeframe: 'menos_3_meses' | '3_6_meses' | '6_12_meses' | 'mais_1_ano';
    weekly_hours: number;
    has_attempted_before: boolean;
    theoretical_base: 'fraca' | 'media' | 'boa' | 'excelente';
}

class UserService {
    // Obter ou criar usuário atual (mock por enquanto)
    async getCurrentUser(): Promise<User | null> {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', '00000000-0000-0000-0000-000000000001')
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }

    // Criar novo usuário
    async createUser(name: string, email: string): Promise<User | null> {
        try {
            const { data, error } = await supabase
                .from('users')
                .insert({
                    name,
                    email,
                    onboarding_completed: false,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating user:', error);
            return null;
        }
    }

    // Obter perfil do usuário
    async getUserProfile(userId: string): Promise<UserProfile | null> {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    // Obter metas do usuário
    async getUserGoals(userId: string): Promise<UserGoals | null> {
        try {
            const { data, error } = await supabase
                .from('user_goals')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting user goals:', error);
            return null;
        }
    }

    // Completar onboarding
    async completeOnboarding(userId: string, onboardingData: OnboardingData): Promise<boolean> {
        try {
            // 1. Criar ou atualizar usuário (UPSERT)
            const { error: userError } = await supabase
                .from('users')
                .upsert({
                    id: userId,
                    name: onboardingData.name,
                    email: onboardingData.email,
                    onboarding_completed: true,
                    last_login: new Date().toISOString(),
                })
                .select()
                .single();

            if (userError) {
                console.error('User upsert error:', userError);
                throw userError;
            }

            // 2. Criar perfil
            const { error: profileError } = await supabase
                .from('user_profiles')
                .upsert({
                    user_id: userId,
                    target_institution: onboardingData.target_institution,
                    target_specialty: onboardingData.target_specialty,
                    exam_timeframe: onboardingData.exam_timeframe,
                    weekly_hours: onboardingData.weekly_hours,
                    has_attempted_before: onboardingData.has_attempted_before,
                    theoretical_base: onboardingData.theoretical_base,
                });

            if (profileError) {
                console.error('Profile upsert error:', profileError);
                throw profileError;
            }

            // 3. Calcular e criar metas
            const goals = this.calculateGoals(onboardingData);
            const { error: goalsError } = await supabase
                .from('user_goals')
                .upsert({
                    user_id: userId,
                    ...goals,
                });

            if (goalsError) {
                console.error('Goals upsert error:', goalsError);
                throw goalsError;
            }

            return true;
        } catch (error) {
            console.error('Error completing onboarding:', error);
            return false;
        }
    }

    // Calcular metas baseadas no perfil
    private calculateGoals(profile: OnboardingData): Omit<UserGoals, 'id' | 'user_id'> {
        const weeklyGoal = profile.weekly_hours;
        const dailyGoal = weeklyGoal / 5; // 5 dias úteis

        // Buscar nota de corte (simplificado)
        const cutScores: Record<string, number> = {
            'ENARE': 75,
            'USP': 50,
            'UNICAMP': 60,
            'SUS-SP': 70,
            'UNIFESP': 65,
        };
        const targetPercentage = cutScores[profile.target_institution] || 70;

        // Calcular divisão teoria/prática
        let theoryPercentage = 50;
        let practicePercentage = 50;

        // Ajustar baseado na base teórica
        if (profile.theoretical_base === 'fraca') {
            theoryPercentage = 70;
            practicePercentage = 30;
        } else if (profile.theoretical_base === 'media') {
            theoryPercentage = 50;
            practicePercentage = 50;
        } else if (profile.theoretical_base === 'boa') {
            theoryPercentage = 30;
            practicePercentage = 70;
        } else if (profile.theoretical_base === 'excelente') {
            theoryPercentage = 10;
            practicePercentage = 90;
        }

        // Ajustar baseado no prazo
        if (profile.exam_timeframe === 'menos_3_meses') {
            // Urgente: mais questões
            practicePercentage += 10;
            theoryPercentage -= 10;
        }

        return {
            daily_hours_goal: Math.round(dailyGoal * 10) / 10,
            weekly_hours_goal: weeklyGoal,
            target_percentage: targetPercentage,
            theory_percentage: Math.max(0, Math.min(100, theoryPercentage)),
            practice_percentage: Math.max(0, Math.min(100, practicePercentage)),
            focus_area: profile.target_specialty,
        };
    }
}

export const userService = new UserService();
