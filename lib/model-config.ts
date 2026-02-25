/**
 * Configuração centralizada dos modelos OpenAI usados no app.
 * Para mudar o modelo em TODO o app, basta alterar aqui.
 */

// Modelo principal para chat, geração de questões e análise
// O mais potente disponível na sua API key será usado
export const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4o';

// Modelo para embeddings (RAG / Tutor IA)
// text-embedding-3-small é o melhor custo-benefício para embeddings
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

// Modelo para tarefas simples (correções, classificação)
// Usa o mesmo modelo principal para máxima qualidade
export const GPT_MODEL_LIGHT = process.env.GPT_MODEL_LIGHT || GPT_MODEL;

// Pricing por 1K tokens (para tracking de custos)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4.1': { input: 0.002, output: 0.008 },
    'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
    'gpt-4.1-nano': { input: 0.0001, output: 0.0004 },
    'gpt-4.5-preview': { input: 0.075, output: 0.15 },
    'gpt-5.2': { input: 0.01, output: 0.03 }, // Estimated pricing
};
