import { query } from './db';
import { userService } from './user-service';
import { getUserStats } from './stats-service';

export interface UserMemory {
    id: string;
    user_id: string;
    memory_text: string;
    category: 'general' | 'learning_style' | 'weakness' | 'strength' | 'goal';
    tags: string[];
    created_at: string;
}

class MemoryService {
    // Salvar uma nova memória observada pela IA
    async saveMemory(userId: string, text: string, category: UserMemory['category'] = 'general', tags: string[] = []): Promise<boolean> {
        try {
            await query(`
                INSERT INTO user_memory (user_id, memory_text, category, tags)
                VALUES ($1, $2, $3, $4)
            `, [userId, text, category, tags]);
            return true;
        } catch (error) {
            console.error('Error saving user memory:', error);
            return false;
        }
    }

    // Buscar as memórias mais recentes
    async getMemories(userId: string, limit = 5): Promise<UserMemory[]> {
        try {
            const { rows } = await query(`
                SELECT * FROM user_memory 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT $2
            `, [userId, limit]);
            return rows;
        } catch (error) {
            console.error('Error fetching user memories:', error);
            return [];
        }
    }

    // Construir o Contexto Completo do Usuário ("Quem é este aluno?")
    // Agrega: Perfil + Metas + Estatísticas + Memórias
    async getUserContext(userId: string): Promise<string> {
        try {
            // 1. Buscar dados em paralelo
            const [profile, goals, stats, memories] = await Promise.all([
                userService.getUserProfile(userId),
                userService.getUserGoals(userId),
                getUserStats(userId),
                this.getMemories(userId, 5)
            ]);

            if (!profile) return "Usuário sem perfil configurado.";

            // 2. Formatar Perfil & Metas
            let context = `ALUNO: ${profile.target_institution} - ${profile.target_specialty}\n`;
            context += `PRAZO: ${profile.exam_timeframe.replace('_', ' ')}\n`;

            if (goals) {
                context += `FOCO: ${goals.focus_area} (Meta Diária: ${goals.daily_hours_goal}h)\n`;
            }

            // 3. Formatar Estatísticas (Pontos Fortes/Fracos)
            if (stats) {
                const weak = stats.weaknesses.map((w: any) => `${w.area} (${w.score}%)`).join(', ');
                const strong = stats.strengths.map((s: any) => `${s.area} (${s.score}%)`).join(', ');
                context += `PONTOS FORTES: ${strong || 'Nenhum identificado'}\n`;
                context += `PONTOS FRACOS: ${weak || 'Nenhum identificado'}\n`;
            }

            // 4. Formatar Memórias (Observações Prévias da IA)
            if (memories && memories.length > 0) {
                context += `\nOBSERVAÇÕES (MEMÓRIA):\n`;
                memories.forEach(m => {
                    context += `- [${m.category}] ${m.memory_text}\n`;
                });
            }

            return context;

        } catch (error) {
            console.error('Error constructing user context:', error);
            return "";
        }
    }

    // AGENTE OBSERVADOR: Analisa o chat e salva fatos importantes
    async analyzeAndSaveMemory(userId: string, userMessage: string, aiResponse: string): Promise<void> {
        try {
            // Ignorar mensagens muito curtas
            if (userMessage.length < 10) return;

            const OpenAI = (await import('openai')).default;
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

            const extractionPrompt = `
                Analise esta interação entre um Aluno de Medicina e um Tutor IA.
                O Aluno disse: "${userMessage}"
                O Tutor respondeu: "${aiResponse}"

                Identifique SE o aluno revelou explicitamente:
                1. Uma dificuldade/fraqueza (Ex: "Não entendo nada de ECG")
                2. Um interesse/foco (Ex: "Quero focar em Pediatria")
                3. Um estilo de aprendizado (Ex: "Prefiro resumos", "Odeio textos longos")
                4. Um fato pessoal relevante para o estudo (Ex: "Tenho prova em 2 semanas")

                Se encontrar algo, retorne APENAS um JSON (sem markdown) no formato:
                {
                    "found": true,
                    "memory_text": "O aluno tem dificuldade em...",
                    "category": "weakness" | "strength" | "goal" | "learning_style" | "general",
                    "tags": ["tag1", "tag2"]
                }

                Se NÃO encontrar nada relevante (apenas conversa nula, dúvidas simples de conteúdo sem revelar perfil), retorne:
                { "found": false }
            `.trim();

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'system', content: extractionPrompt }],
                response_format: { type: "json_object" }
            });

            const result = JSON.parse(completion.choices[0].message.content || '{}');

            if (result.found && result.memory_text) {
                console.log('🧠 [Agente Observador] Nova memória detectada:', result.memory_text);
                await this.saveMemory(userId, result.memory_text, result.category, result.tags);
            }

        } catch (error) {
            console.error('Error in memory analysis observer:', error);
            // Não falhar o chat principal se o observador falhar
        }
    }
}

export const memoryService = new MemoryService();
