import OpenAI from 'openai';
import { db, query } from './db';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const aiService = {
    /**
     * Gera o vetor (embedding) para um texto usando o modelo da OpenAI.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: text.replace(/\n/g, ' '),
            dimensions: 1536,
        });
        return response.data[0].embedding;
    },

    /**
     * Busca trechos de documentos similares no banco de dados (RAG).
     */
    async searchKnowledgeBase(userQuery: string, matchCount = 5) {
        // 1. Gerar embedding da pergunta
        const queryEmbedding = await this.generateEmbedding(userQuery);

        // 2. Buscar no banco usando similaridade de cosseno (pgvector)
        // O operador <=> é a distância cosseno (quanto menor, mais similar)
        // Mas para ordenação padrão de "similaridade", costuma-se usar 1 - distância ou apenas ordenar por distância ASC.
        // No pgvector, <=> é distância euclidiana, <#> é produto interno, etc.
        // Para embeddings normalizados (OpenAI), produto interno (<#>) é mais rápido e equivale a similaridade de cosseno.
        // Mas a convenção mais simples é usar o operador de distância cosine (<=>) e pegar os menores valores.

        const embeddingString = `[${queryEmbedding.join(',')}]`;

        const { rows } = await query(`
            SELECT 
                de.content,
                de.document_id,
                de.metadata,
                1 - (de.embedding <=> $1) as similarity
            FROM document_embeddings de
            WHERE 1 - (de.embedding <=> $1) > 0.3 -- Threshold mínimo de relevância
            ORDER BY de.embedding <=> $1 ASC
            LIMIT $2
        `, [embeddingString, matchCount]);

        return rows;
    },

    /**
     * Divide o texto em pedaços (chunks) para indexação.
     */
    chunkText(text: string, maxTokens = 800): string[] {
        const maxChars = maxTokens * 4; // ~4 chars per token
        const overlap = 150; // 150 chars of overlap between chunks
        const paragraphs = text.split(/\n\s*\n/);
        const chunks: string[] = [];
        let currentChunk = '';

        for (const para of paragraphs) {
            if ((currentChunk.length + para.length) < maxChars) {
                currentChunk += para + '\n\n';
            } else {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                    // Keep overlap from end of current chunk
                    const overlapText = currentChunk.slice(-overlap);
                    currentChunk = overlapText + '\n\n' + para + '\n\n';
                } else {
                    // Paragraph itself is too long, split it
                    const sentences = para.split(/(?<=[.!?])\s+/);
                    for (const sentence of sentences) {
                        if ((currentChunk.length + sentence.length) < maxChars) {
                            currentChunk += sentence + ' ';
                        } else {
                            if (currentChunk) chunks.push(currentChunk.trim());
                            currentChunk = sentence + ' ';
                        }
                    }
                }
            }
        }
        if (currentChunk.trim()) chunks.push(currentChunk.trim());

        return chunks;
    },

    /**
     * AI Question Generation — RAG-grounded, medically accurate
     * Used as fallback when DB doesn't have enough matching questions.
     */
    async generateQuestions(params: {
        area: string;
        count: number;
        difficulty?: string;
        subareas?: string[];
        institution?: string;
    }): Promise<any[]> {
        const { GPT_MODEL } = await import('./model-config');

        // 1. Search RAG for relevant medical content to ground the questions
        console.log(`[AI-Gen] Searching RAG for "${params.area}" content...`);
        const searchQuery = `questões prova residência médica ${params.area} ${params.subareas?.join(' ') || ''}`.trim();
        let ragContext = '';
        let ragSources: string[] = [];

        try {
            const ragChunks = await this.searchKnowledgeBase(searchQuery, 10);
            if (ragChunks && ragChunks.length > 0) {
                ragContext = ragChunks.map((chunk: any) => {
                    const meta = typeof chunk.metadata === 'string' ? JSON.parse(chunk.metadata) : (chunk.metadata || {});
                    const source = meta.institution ? `[${meta.institution} ${meta.year || ''}]` : '[Base]';
                    if (meta.institution) ragSources.push(`${meta.institution} ${meta.year || ''}`);
                    return `${source}\n${chunk.content}`;
                }).join('\n---\n');
                console.log(`[AI-Gen] Found ${ragChunks.length} RAG chunks as grounding.`);
            } else {
                console.log('[AI-Gen] No RAG chunks found — using general medical knowledge.');
            }
        } catch (ragErr) {
            console.error('[AI-Gen] RAG search failed (non-fatal):', ragErr);
        }

        // 2. Build strict prompt for medically accurate question generation
        const systemPrompt = `Você é um especialista em criar questões de prova de Residência Médica brasileira.

### REGRAS ABSOLUTAS (NUNCA viole):
1. Cada questão DEVE ser factualmente correta segundo guidelines médicos brasileiros atuais (Ministério da Saúde, SBP, ACOG, Harrison, etc.)
2. A resposta correta DEVE ser indiscutivelmente correta — sem ambiguidade
3. As 4 alternativas incorretas DEVEM ser plausíveis mas claramente erradas para quem estudou o tema
4. A explicação DEVE citar o raciocínio clínico e, quando possível, a fonte (guideline, protocolo, consenso)
5. NUNCA invente dados estatísticos, doses ou protocolos. Se não tiver certeza, NÃO gere a questão
6. Use linguagem clínica objetiva, como em provas reais do ENARE, USP, UNIFESP
7. Varie os temas DENTRO da área solicitada — não repita o mesmo assunto

### FORMATO OBRIGATÓRIO (JSON array):
[
  {
    "stem": "Enunciado clínico completo (caso clínico + pergunta). Mínimo 80 caracteres.",
    "option_a": "Alternativa A",
    "option_b": "Alternativa B", 
    "option_c": "Alternativa C",
    "option_d": "Alternativa D",
    "option_e": "Alternativa E",
    "correct_option": "A",
    "explanation": "Explicação detalhada com raciocínio clínico. Mínimo 100 caracteres.",
    "area": "${params.area}",
    "subarea": "Subtema específico",
    "topic": "Tópico exato"
  }
]

### QUALIDADE MÍNIMA:
- Enunciado: apresente um CASO CLÍNICO realista (paciente, idade, sintomas, exames) e faça uma PERGUNTA objetiva
- NUNCA faça perguntas genéricas tipo "Qual das alternativas é correta?"
- Cada alternativa deve ter entre 10-200 caracteres
- A explicação deve ensinar o aluno — explique POR QUE a correta é correta E por que as outras são erradas`;

        const userPrompt = `Gere EXATAMENTE ${params.count} questões de ${params.area}${params.subareas?.length ? ` (subtemas: ${params.subareas.join(', ')})` : ''}${params.difficulty ? ` com dificuldade ${params.difficulty}` : ''} para prova de Residência Médica.

${ragContext ? `### CONTEÚDO DE REFERÊNCIA (use como base primária):\n${ragContext}\n\nUse esse conteúdo como FONTE PRIMÁRIA. Baseie as questões nesses temas e informações.` : '### SEM CONTEÚDO DE REFERÊNCIA DISPONÍVEL\nUse seu conhecimento médico consolidado. Foque em temas clássicos de prova de residência.'}

IMPORTANTE: Retorne APENAS o JSON array, sem markdown, sem explicações extras.`;

        // 3. Call GPT
        console.log(`[AI-Gen] Generating ${params.count} questions via ${GPT_MODEL}...`);
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7, // Some creativity but not too wild
            max_tokens: params.count * 800, // ~800 tokens per question
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content || '{}';
        console.log(`[AI-Gen] Response received (${content.length} chars)`);

        // 4. Parse and validate
        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch (parseErr) {
            console.error('[AI-Gen] Failed to parse JSON:', content.substring(0, 200));
            return [];
        }

        // Handle both {questions: [...]} and direct [...] format
        const rawQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.questoes || []);

        // 5. Strict validation — reject malformed questions
        const validated = rawQuestions.filter((q: any, i: number) => {
            if (!q.stem || q.stem.length < 50) {
                console.warn(`[AI-Gen] Q${i + 1} rejected: stem too short (${q.stem?.length || 0} chars)`);
                return false;
            }
            if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) {
                console.warn(`[AI-Gen] Q${i + 1} rejected: missing options`);
                return false;
            }
            if (!['A', 'B', 'C', 'D', 'E'].includes(q.correct_option?.toUpperCase())) {
                console.warn(`[AI-Gen] Q${i + 1} rejected: invalid correct_option "${q.correct_option}"`);
                return false;
            }
            if (!q.explanation || q.explanation.length < 30) {
                console.warn(`[AI-Gen] Q${i + 1} rejected: explanation too short`);
                return false;
            }
            return true;
        });

        console.log(`[AI-Gen] Validated: ${validated.length}/${rawQuestions.length} questions passed`);

        // 6. Log API cost
        const tokensIn = response.usage?.prompt_tokens || 0;
        const tokensOut = response.usage?.completion_tokens || 0;
        const { MODEL_PRICING } = await import('./model-config');
        const pricing = MODEL_PRICING[GPT_MODEL] || { input: 0.005, output: 0.015 };
        const cost = ((tokensIn / 1000) * pricing.input) + ((tokensOut / 1000) * pricing.output);

        try {
            await query(`
                INSERT INTO api_usage_logs (provider, model, tokens_input, tokens_output, cost_usd, action, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
            `, ['openai', GPT_MODEL, tokensIn, tokensOut, cost.toFixed(6), 'generate_questions']);
            console.log(`[AI-Gen] 💰 Cost: $${cost.toFixed(4)} (${tokensIn} in / ${tokensOut} out)`);
        } catch (logErr) {
            console.error('[AI-Gen] Failed to log cost (non-fatal):', logErr);
        }

        // 7. Return with metadata
        return validated.map((q: any, i: number) => ({
            ...q,
            correct_option: q.correct_option.toUpperCase(),
            area: q.area || params.area,
            ai_generated: true,
            ai_source: ragSources.length > 0 ? ragSources.slice(0, 3).join(', ') : 'Conhecimento médico consolidado',
        }));
    }
};
