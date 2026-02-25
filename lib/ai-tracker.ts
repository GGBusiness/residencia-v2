import { query } from './db';

interface AIUsageParams {
    provider: 'openai' | 'anthropic';
    model: string;
    tokensInput: number;
    tokensOutput: number;
    context: string;
    userId?: string;
}

// Pricing (Approximate per 1k tokens as of 2024)
const PRICING: Record<string, { input: number; output: number }> = {
    // Anthropic
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },

    // OpenAI
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-4.1': { input: 0.002, output: 0.008 },
    'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
    'gpt-5.2': { input: 0.01, output: 0.03 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
};

export const aiTracker = {
    async logUsage({ provider, model, tokensInput, tokensOutput, context, userId }: AIUsageParams) {
        try {
            const price = PRICING[model] || { input: 0, output: 0 };
            const cost = (tokensInput / 1000 * price.input) + (tokensOutput / 1000 * price.output);

            await query(`
                INSERT INTO api_usage_logs (provider, model, tokens_input, tokens_output, cost_usd, context, user_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [provider, model, tokensInput, tokensOutput, cost, context, userId]);

            console.log(`💰 [AI Tracker] usage logged: $${cost.toFixed(6)} (${context})`);
        } catch (error) {
            console.error('❌ [AI Tracker] Failed to log usage:', error);
            // Non-blocking error
        }
    }
};
