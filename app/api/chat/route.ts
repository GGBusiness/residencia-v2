import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';
import { aiService } from '@/lib/ai-service';
import { memoryService } from '@/lib/memory-service';
import { GPT_MODEL } from '@/lib/model-config';
import { getCutScore } from '@/lib/stats-service';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const supabase = createRouteHandlerClient({ cookies });

        // 1. Get User Context (Who am I talking to?)
        let userContext = "";
        let userInstitution = "";
        let userSpecialty = "";
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                console.log('🧠 Loading User Memory for:', session.user.id);
                userContext = await memoryService.getUserContext(session.user.id);

                // Get user profile for notas de corte
                const { rows: profiles } = await query(
                    `SELECT target_institution, target_specialty FROM user_profiles WHERE id = $1 LIMIT 1`,
                    [session.user.id]
                );
                if (profiles.length > 0) {
                    userInstitution = profiles[0].target_institution || '';
                    userSpecialty = profiles[0].target_specialty || '';
                }
            }
        } catch (ctxError) {
            console.error('⚠️ Failed to load user context:', ctxError);
        }

        // 2. Get the latest user message
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage.content;

        console.log('💬 New Chat Query:', userQuery);

        // 3. Search in Knowledge Base (DigitalOcean RAG)
        let knowledgeContext = '';
        try {
            console.log('🕵️‍♂️ Searching Knowledge Base...');
            const knowledgeChunks = await aiService.searchKnowledgeBase(userQuery, 5);

            if (knowledgeChunks && knowledgeChunks.length > 0) {
                knowledgeContext = knowledgeChunks.map((chunk: any) => {
                    const meta = typeof chunk.metadata === 'string' ? JSON.parse(chunk.metadata) : (chunk.metadata || {});
                    const source = meta.institution ? `[${meta.institution} ${meta.year || ''}]` : `[${meta.filename || 'Base'}]`;
                    return `${source} ${chunk.content}`;
                }).join('\n---\n');
                console.log(`✅ Found ${knowledgeChunks.length} relevant chunks.`);
            } else {
                console.log('⚠️ No relevant knowledge found.');
            }
        } catch (searchError) {
            console.error('❌ RAG Search Error:', searchError);
        }

        // 4. Get Notas de Corte for user's target
        let cutScoreContext = '';
        if (userInstitution) {
            try {
                const cutScore = await getCutScore(userInstitution, userSpecialty || 'Geral');
                if (cutScore) {
                    cutScoreContext = `\n### NOTA DE CORTE (${userInstitution} - ${userSpecialty || 'Geral'}):\n` +
                        `Nota de corte: ${cutScore.passing_score || 'N/A'}/${cutScore.total_questions || 'N/A'} (${cutScore.percentage ? cutScore.percentage.toFixed(0) + '%' : 'N/A'}) | Ano: ${cutScore.year || 'N/A'}\n` +
                        `Use essa informação para contextualizar: "Para o ${userInstitution}, você precisa de pelo menos ${cutScore.percentage ? cutScore.percentage.toFixed(0) + '%' : 'X%'} nessa área."`;
                }
            } catch (cutErr) {
                console.error('⚠️ Failed to load cut scores:', cutErr);
            }
        }

        // 5. Construct System Instruction with ALL contexts
        const baseSystemInstruction = `
            Você é o Dr. IA, um tutor especialista em Residência Médica (ENARE, USP, etc).
            Modelo: ${GPT_MODEL}
            
            ### QUEM É VOCÊ:
            - Um mentor experiente, didático e objetivo.
            - Focado 100% em aprovar o aluno na Residência.
            - Usa "pulo do gato", mnemônicos e dicas de prova.
            - Tem acesso a uma base de conhecimento crescente com conteúdo de provas reais e materiais de estudo.

            ### O ALUNO (CONTEXTO):
            ${userContext || "Aluno não identificado."}
            ${cutScoreContext}

            ### DIRETRIZES:
            1. Personalize a resposta: Se o aluno for fraco em um tema, explique do zero. Se for forte, aprofunde.
            2. Se o "CONTEÚDO DE APOIO" for citado abaixo, USE-O como fonte primária e CITE a instituição/ano quando possível.
            3. Se não houver contexto, use seu conhecimento médico.
            4. Compare o desempenho do aluno com as notas de corte quando relevante.
            5. Sempre termine encorajando ou sugerindo uma próxima pergunta relacionada ao ponto fraco do aluno.
            6. Se o aluno perguntar sobre uma área onde temos questões no banco, sugira: "Quer que eu monte um simulado sobre isso?"
        `.trim();

        const finalSystemInstruction = knowledgeContext
            ? `${baseSystemInstruction}\n\n### CONTEÚDO DE APOIO (Provas e Materiais Indexados):\n${knowledgeContext}`
            : baseSystemInstruction;

        // 5. Call OpenAI with Context
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: 'system', content: finalSystemInstruction },
                ...messages
            ],
            stream: true,
        });

        // 6. Stream response with Memory Analysis (Agent Observer)
        const stream = OpenAIStream(response as any, {
            onFinal(completion) {
                // Background Task: Analyze conversation for new memories
                // Only if we have a valid user
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session?.user?.id) {
                        console.log('🕵️ [Observer] Analyzing detailed interaction...');
                        memoryService.analyzeAndSaveMemory(session.user.id, userQuery, completion);
                    }
                });
            }
        });
        return new StreamingTextResponse(stream);

    } catch (error) {
        console.error('❌ Error in chat API:', error);
        return new Response(JSON.stringify({ error: 'Failed to process chat request' }), { status: 500 });
    }
}
