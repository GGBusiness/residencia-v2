
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function setupAssistant() {
    console.log('🤖 Criando Agente de Residência Médica voa API...');

    try {
        // 1. Create the Assistant
        const assistant = await openai.beta.assistants.create({
            name: "Preceptor Residência Médica",
            description: "Tutor especialista em provas de residência médica.",
            model: "gpt-4o",
            tools: [{ type: "file_search" }],
            instructions: `
Você é um Preceptor de Residência Médica de elite.
Sua função é ajudar estudantes a passarem nas provas de residência (ENARE, USP, SUS-SP, etc).

CARACTERÍSTICAS:
- Você tem acesso a arquivos de conhecimento (provas, apostilas) via tool 'file_search'.
- SEMPRE verifique seus arquivos antes de responder se a pergunta for técnica.
- Se a resposta estiver nos arquivos, cite a fonte.
- Se não estiver, use seu conhecimento de GPT-4o, mas avise que é uma resposta baseada em conhecimento geral.
- Seja didático, use bullet points, e explique o "pulo do gato" das questões.
      `
        });

        console.log('✅ Agente criado com sucesso!');
        console.log('--------------------------------------------------');
        console.log(`ID do Agente: ${assistant.id}`);
        console.log('--------------------------------------------------');
        console.log('Salvar este ID no arquivo .env.local como OPENAI_ASSISTANT_ID');

    } catch (error) {
        console.error('Erro ao criar assistente:', error);
    }
}

setupAssistant();
