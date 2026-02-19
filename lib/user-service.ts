import { db, query } from './db';
import { supabase } from './supabase'; // Mantido apenas para tipos ou auth se necessário

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
    best_study_time: 'manha' | 'tarde' | 'noite' | 'madrugada' | 'variavel';
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
    target_institutions?: { institution: string; weight: number }[];
    target_specialty: string;
    exam_timeframe: 'menos_3_meses' | '3_6_meses' | '6_12_meses' | 'mais_1_ano';
    weekly_hours: number;
    has_attempted_before: boolean;
    theoretical_base: 'fraca' | 'media' | 'boa' | 'excelente';
    best_study_time: 'manha' | 'tarde' | 'noite' | 'madrugada' | 'variavel';
}

class UserService {
    // Obter dados do usuário (Via Postgres)
    async getCurrentUser(userId: string): Promise<User | null> {
        try {
            const { rows } = await query('SELECT * FROM users WHERE id = $1', [userId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    }

    // Sincronizar usuário (UPSERT) - Garante que existe na tabela public.users
    async syncUser(id: string, email: string, name: string): Promise<User | null> {
        try {
            const { rows } = await query(`
                INSERT INTO users (id, email, name, last_login)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (id) DO UPDATE 
                SET email = EXCLUDED.email,
                    name = EXCLUDED.name,
                    last_login = NOW()
                RETURNING *
            `, [id, email, name]);
            return rows[0];
        } catch (error) {
            console.error('Error syncing user:', error);
            return null;
        }
    }

    // Criar novo usuário (Geralmente via Auth Hook, mas mantendo utilitário)
    async createUser(name: string, email: string, id: string): Promise<User | null> {
        return this.syncUser(id, email, name);
    }

    // Obter perfil do usuário
    async getUserProfile(userId: string): Promise<UserProfile | null> {
        try {
            const { rows } = await query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error getting user profile:', error);
            return null;
        }
    }

    // Obter metas do usuário
    async getUserGoals(userId: string): Promise<UserGoals | null> {
        try {
            const { rows } = await query('SELECT * FROM user_goals WHERE user_id = $1', [userId]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error getting user goals:', error);
            return null;
        }
    }

    // Completar onboarding
    async completeOnboarding(userId: string, onboardingData: OnboardingData): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('🚀 Finalizando Onboarding no DigitalOcean para:', userId);

            // 1. Atualizar user
            try {
                await query(`
                    INSERT INTO users (id, name, email, onboarding_completed, last_login)
                    VALUES ($1, $2, $3, TRUE, NOW())
                    ON CONFLICT (id) DO UPDATE 
                    SET name = EXCLUDED.name,
                        email = EXCLUDED.email,
                        onboarding_completed = TRUE,
                        last_login = NOW()
                `, [userId, onboardingData.name, onboardingData.email]);
            } catch (err: any) {
                console.error('Error updating main user table:', err);
                return { success: false, error: `Erro na tabela de usuários: ${err.message}` };
            }

            // 2. Upsert Perfil
            try {
                // Ensure target_institutions column exists
                await query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS target_institutions JSONB`).catch(() => { });

                await query(`
                INSERT INTO user_profiles 
                (user_id, target_institution, target_institutions, target_specialty, exam_timeframe, weekly_hours, has_attempted_before, theoretical_base, best_study_time)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (user_id) DO UPDATE
                SET target_institution = EXCLUDED.target_institution,
                    target_institutions = EXCLUDED.target_institutions,
                    target_specialty = EXCLUDED.target_specialty,
                    exam_timeframe = EXCLUDED.exam_timeframe,
                    weekly_hours = EXCLUDED.weekly_hours,
                    has_attempted_before = EXCLUDED.has_attempted_before,
                    theoretical_base = EXCLUDED.theoretical_base,
                    best_study_time = EXCLUDED.best_study_time
            `, [
                    userId,
                    onboardingData.target_institution,
                    JSON.stringify(onboardingData.target_institutions || [{ institution: onboardingData.target_institution, weight: 100 }]),
                    onboardingData.target_specialty,
                    onboardingData.exam_timeframe,
                    onboardingData.weekly_hours,
                    onboardingData.has_attempted_before,
                    onboardingData.theoretical_base,
                    onboardingData.best_study_time
                ]);
            } catch (err: any) {
                console.error('Error updating user profile:', err);
                return { success: false, error: `Erro no perfil: ${err.message}` };
            }

            // 3. Calcular e Upsert Metas
            try {
                const goals = this.calculateGoals(onboardingData);
                await query(`
                    INSERT INTO user_goals 
                    (user_id, daily_hours_goal, weekly_hours_goal, target_percentage, theory_percentage, practice_percentage, focus_area)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (user_id) DO UPDATE
                    SET daily_hours_goal = EXCLUDED.daily_hours_goal,
                        weekly_hours_goal = EXCLUDED.weekly_hours_goal,
                        target_percentage = EXCLUDED.target_percentage,
                        theory_percentage = EXCLUDED.theory_percentage,
                        practice_percentage = EXCLUDED.practice_percentage,
                        focus_area = EXCLUDED.focus_area
                `, [
                    userId,
                    goals.daily_hours_goal,
                    goals.weekly_hours_goal,
                    goals.target_percentage,
                    goals.theory_percentage,
                    goals.practice_percentage,
                    goals.focus_area
                ]);
            } catch (err: any) {
                console.error('Error updating user goals:', err);
                return { success: false, error: `Erro nas metas: ${err.message}` };
            }

            console.log('✅ Onboarding concluído com sucesso para:', userId);
            return { success: true };
        } catch (error: any) {
            console.error('Unexpected error completing onboarding:', error);
            return { success: false, error: error.message };
        }
    }

    // Atualizar dados do usuário (tabela users)
    async updateUser(userId: string, data: Partial<User>): Promise<boolean> {
        try {
            const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'email'); // Email usually managed by Auth provider, restricting for now
            if (fields.length === 0) return false;

            const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
            const values = fields.map(f => (data as any)[f]);

            await query(`UPDATE users SET ${setClause} WHERE id = $1`, [userId, ...values]);
            return true;
        } catch (error) {
            console.error('Error updating user:', error);
            throw error;
        }
    }

    // Atualizar perfil (tabela user_profiles)
    async updateProfile(userId: string, data: Partial<UserProfile>): Promise<boolean> {
        try {
            const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'user_id');
            if (fields.length === 0) return false;

            const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
            const values = fields.map(f => (data as any)[f]);

            await query(`UPDATE user_profiles SET ${setClause} WHERE user_id = $1`, [userId, ...values]);
            return true;
        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    }

    // Atualizar metas (tabela user_goals)
    async updateGoals(userId: string, data: Partial<UserGoals>): Promise<boolean> {
        try {
            const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'user_id');
            if (fields.length === 0) return false;

            const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
            const values = fields.map(f => (data as any)[f]);

            await query(`UPDATE user_goals SET ${setClause} WHERE user_id = $1`, [userId, ...values]);
            return true;
        } catch (error) {
            console.error('Error updating goals:', error);
            throw error;
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
