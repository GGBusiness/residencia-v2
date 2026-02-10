
import { userService, type UserProfile, type UserGoals } from '@/lib/user-service';
import { dataService } from '@/lib/data-service';

export interface DailyPlan {
    message: string;
    focusArea: string;
    recommendedConfig: {
        program?: string;
        area?: string;
        questionCount: number;
        years: number[];
    };
}

class PlannerService {
    /**
     * Gera um plano de estudo diário baseado no perfil e meta do usuário
     */
    async getDailyPlan(userId: string): Promise<DailyPlan | null> {
        try {
            // 1. Obter dados do usuário
            const profile = await userService.getUserProfile(userId);
            const goals = await userService.getUserGoals(userId);

            if (!profile || !goals) return null;

            // 2. Definir estratégia baseada no dia da semana (simulado)
            // Em produção, isso leria o histórico de tentativas para ver pontos fracos
            const dayOfWeek = new Date().getDay(); // 0 = Domingo, 1 = Segunda...

            // Estratégia simples:
            // Segunda/Quarta/Sexta: Foco na Meta Principal (Instituição)
            // Terça/Quinta: Foco na Especialidade Alvo (Area)
            // Sábado/Domingo: Simulado Geral / Revisão

            const isInstitutionDay = [1, 3, 5].includes(dayOfWeek);
            const isWeekend = [0, 6].includes(dayOfWeek);

            let message = '';
            let focusArea = '';
            let recommendedConfig = {
                program: undefined as string | undefined,
                area: undefined as string | undefined,
                questionCount: 20, // Default rápido
                years: [2024, 2025, 2026] // Anos recentes
            };

            const targetInstitution = profile.target_institution;
            const targetSpecialty = profile.target_specialty || 'Clínica Médica'; // Fallback

            // Mapear especialidade para Área do banco
            const areaMap: Record<string, string> = {
                'Cardiologia': 'Clínica Médica',
                'Dermatologia': 'Clínica Médica',
                'Endocrinologia': 'Clínica Médica',
                'Gastroenterologia': 'Clínica Médica',
                'Pediatria': 'Pediatria',
                'Ginecologia': 'GO',
                'Obstetrícia': 'GO',
                'Cirurgia Geral': 'Cirurgia',
                'Anestesiologia': 'Cirurgia',
                'Psiquiatria': 'Clínica Médica', // Aprox
                'Preventiva': 'Preventiva',
                'Infectologia': 'Clínica Médica'
            };

            const dbArea = areaMap[targetSpecialty] || 'Clínica Médica';

            if (isWeekend) {
                message = `Hoje é dia de simulado focado na ${targetInstitution}! 🚀`;
                focusArea = 'Simulado Geral';
                recommendedConfig.program = targetInstitution;
                recommendedConfig.questionCount = 50; // Mais longo no FDS
            } else if (isInstitutionDay) {
                message = `Vamos dominar as provas da ${targetInstitution} hoje?`;
                focusArea = `Foco em ${targetInstitution}`;
                recommendedConfig.program = targetInstitution;
                recommendedConfig.questionCount = Math.ceil(goals.daily_hours_goal * 15); // Aprox 15 questões por hora
            } else {
                message = `Hoje o foco é fortalecer sua base em ${dbArea}.`;
                focusArea = dbArea;
                recommendedConfig.area = dbArea;
                recommendedConfig.questionCount = Math.ceil(goals.daily_hours_goal * 15);
            }

            return {
                message,
                focusArea,
                recommendedConfig
            };

        } catch (error) {
            console.error('Error generating daily plan:', error);
            return null;
        }
    }
}

export const plannerService = new PlannerService();
