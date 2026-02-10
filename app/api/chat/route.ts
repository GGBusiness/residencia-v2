import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';
import { aiService } from '@/lib/ai-service';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // 1. Get the latest user message
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage.content;

        console.log('💬 New Chat Query:', userQuery);

        // 2. Search in Knowledge Base (DigitalOcean RAG)
        let contextText = '';
        try {
            console.log('🕵️‍♂️ Searching Knowledge Base...');
            const knowledgeChunks = await aiService.searchKnowledgeBase(userQuery, 4); // Top 4 chunks

            if (knowledgeChunks && knowledgeChunks.length > 0) {
                contextText = knowledgeChunks.map((chunk: any) => chunk.content).join('\n---\n');
                console.log(`✅ Found ${knowledgeChunks.length} relevant chunks.`);
            } else {
                console.log('⚠️ No relevant knowledge found.');
            }
        } catch (searchError) {
            console.error('❌ RAG Search Error:', searchError);
            // Non-blocking: proceed without context
        }

        // 3. Construct System Instruction with Context
        const baseSystemInstruction = `
            Você é um tutor especialista em Residência Médica (ENARE, USP, etc). 
            Seu objetivo é ajudar alunos a responderem questões de provas e tirar dúvidas teóricas.
            
            Diretrizes:
            1. Seja didático, objetivo e encorajador.
            2. Explique o conceito médico diretamente.
            3. Use OBRIGATORIAMENTE o "CONTEÚDO DE APOIO" abaixo se ele for pertinente à pergunta.
            4. Se a resposta estiver no contexto, cite: "Segundo o material da [Instituição/Ano]..."
            5. Se o contexto não ajudar, use seu conhecimento geral de medicina, mas avise que é uma resposta geral.
            
            IMPORTANTE: O aluno está focado em provas. Dê dicas de "pulo do gato" ou "pegadinhas" comuns sobre o tema.
        `.trim();

        const finalSystemInstruction = contextText
            ? `${baseSystemInstruction}\n\n### CONTEÚDO DE APOIO (Reference Material):\n${contextText}`
            : baseSystemInstruction;

        // 4. Call OpenAI with Context
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: finalSystemInstruction },
                ...messages
            ],
            stream: true,
        });

        // 5. Stream response
        const stream = OpenAIStream(response as any);
        return new StreamingTextResponse(stream);

    } catch (error) {
        console.error('❌ Error in chat API:', error);
        return new Response(JSON.stringify({ error: 'Failed to process chat request' }), { status: 500 });
    }
}
