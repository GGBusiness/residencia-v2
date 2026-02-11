import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';
import { aiService } from '@/lib/ai-service';
import { memoryService } from '@/lib/memory-service';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                console.log('🧠 Loading User Memory for:', session.user.id);
                userContext = await memoryService.getUserContext(session.user.id);
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
            const knowledgeChunks = await aiService.searchKnowledgeBase(userQuery, 4); // Top 4 chunks

            if (knowledgeChunks && knowledgeChunks.length > 0) {
                knowledgeContext = knowledgeChunks.map((chunk: any) => chunk.content).join('\n---\n');
                console.log(`✅ Found ${knowledgeChunks.length} relevant chunks.`);
            } else {
                console.log('⚠️ No relevant knowledge found.');
            }
        } catch (searchError) {
            console.error('❌ RAG Search Error:', searchError);
        }

        // 4. Construct System Instruction with User + Knowledge Context
        const baseSystemInstruction = `
            Você é o Dr. IA, um tutor especialista em Residência Médica (ENARE, USP, etc).
            
            ### QUEM É VOCÊ:
            - Um mentor experiente, didático e objetivo.
            - Focado 100% em aprovar o aluno na Residência.
            - Usa "pulo do gato", mnemônicos e dicas de prova.

            ### O ALUNO (CONTEXTO):
            ${userContext || "Aluno não identificado."}

            ### DIRETRIZES:
            1. Personalize a resposta: Se o aluno for fraco em um tema, explique do zero. Se for forte, aprofunde.
            2. Se o "CONTEÚDO DE APOIO" for citado abaixo, USE-O como fonte primária.
            3. Se não houver contexto, use seu conhecimento médico (GPT-4o).
            4. Sempre termine encorajando ou sugerindo uma próxima pergunta relacionada ao ponto fraco do aluno.
        `.trim();

        const finalSystemInstruction = knowledgeContext
            ? `${baseSystemInstruction}\n\n### CONTEÚDO DE APOIO (Reference Material):\n${knowledgeContext}`
            : baseSystemInstruction;

        // 5. Call OpenAI with Context
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
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
