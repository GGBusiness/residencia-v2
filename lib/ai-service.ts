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
    }
};
