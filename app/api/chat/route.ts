
import { createClient } from '@supabase/supabase-js';
import { AssistantResponse, OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // 1. Get the latest user message
        const lastMessage = messages[messages.length - 1];
        const userQuery = lastMessage.content;

        // 2. Generate embedding for the query
        // We use a lightweight instance for this specific call to avoid full client overhead if not needed globally
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: userQuery.substring(0, 8000),
            dimensions: 1536,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        // 3. Search in Knowledge Base (Supabase)
        // Check if we have the match_knowledge function (created via setup-knowledge.sql)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must use Service Role for RAG to ensure we can read all docs

        // Fallback to Anon key if Service Role is missing (though RAG usually needs Service Role for strictly private docs, 
        // here docs are likely public/system-wide)
        const supabase = createClient(supabaseUrl, supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

        // Search Knowledge Docs
        const { data: knowledgeChunks, error: knowledgeError } = await supabase.rpc('match_knowledge', {
            query_embedding: queryEmbedding,
            match_threshold: 0.5, // Sensitivity
            match_count: 3 // Top 3 chunks
        });

        if (knowledgeError) {
            console.warn('RAG Search Error (match_knowledge):', knowledgeError.message);
            // Verify if function exists or if table exists. Proceed without context if fails.
        }

        // Search Question Bank (Optional: Can also search questions to reference similar ones)
        // For now, let's focus on the Knowledge Docs as requested ("fornecer material")

        let contextText = '';
        if (knowledgeChunks && knowledgeChunks.length > 0) {
            contextText = knowledgeChunks.map((chunk: any) => chunk.content).join('\n---\n');
            console.log(`Found ${knowledgeChunks.length} knowledge chunks for RAG.`);
        }

        // 4. Construct System Instruction with Context
        const baseSystemInstruction = `
            Você é um tutor especialista em Residência Médica. 
            Seu objetivo é ajudar alunos a responderem questões de provas e tirar dúvidas.
            
            Contexto: O aluno está estudando.
            
            Diretrizes:
            1. Seja didático e objetivo.
            2. Explique o conceito médico diretamente.
            3. Use o contexto fornecido abaixo (se houver) para embasar sua resposta.
            4. Se o contexto trouxer diretrizes ou artigos, cite-os.
            5. Mantenha um tom encorajador.
            
            IMPORTANTE: NÃO cite "De acordo com o documento..." de forma robótica. Integre o conhecimento naturalmente.
        `.trim();

        const finalSystemInstruction = contextText
            ? `${baseSystemInstruction}\n\nCONTEÚDO DE APOIO (Use para responder):\n${contextText}`
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

        const stream = OpenAIStream(response as any);
        return new StreamingTextResponse(stream);

    } catch (error) {
        console.error('Error in chat API:', error);
        return new Response(JSON.stringify({ error: 'Failed to process chat request' }), { status: 500 });
    }
}
