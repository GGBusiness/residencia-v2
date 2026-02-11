'use server';

import { createServerClient } from '@/lib/supabase';
// Dynamic import for pdf-parse handled inside the function to avoid build issues

export async function ingestPDFAction(formData: FormData) {
    console.log('📄 Iniciando ingestão de PDF...');

    try {
        const file = formData.get('file') as File;
        if (!file) {
            throw new Error('Nenhum arquivo enviado.');
        }

        // 1. Converter File para Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Extrair Texto com pdf-parse
        // Importação dinâmica idêntica ao script local
        const pdfParseModule: any = await import('pdf-parse');
        let pdfParse = pdfParseModule.default || pdfParseModule;

        // Fallback robusto para encontrar a função principal
        if (typeof pdfParse !== 'function') {
            for (const key of Object.keys(pdfParseModule)) {
                if (typeof pdfParseModule[key] === 'function') {
                    pdfParse = pdfParseModule[key];
                    break;
                }
            }
        }

        if (typeof pdfParse !== 'function') {
            throw new Error('Falha ao carregar biblioteca PDF-Parse.');
        }

        const data = await pdfParse(buffer);
        const pdfText = data.text;

        console.log(`  ✅ Texto extraído: ${pdfText.length} caracteres`);

        // 3. Enviar para OpenAI (GPT-4o) para extração
        // Trocamos Anthropic por OpenAI para simplificar chaves
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        if (!process.env.OPENAI_API_KEY) throw new Error('Chave da OpenAI não configurada.');

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "Você é um especialista em extrair questões de provas médicas. Retorne APENAS um JSON válido."
                },
                {
                    role: "user",
                    content: `EXTRAIA AS QUESTÕES DESTE TEXTO.
Para cada questão, retorne JSON com:
{
    "question_text": "texto do enunciado",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "option_e": "..." (ou null),
    "correct_answer": "A" (se não souber, chute A),
    "area": "Clinica Medica" (detecte pelo contexto),
    "explanation": "..." (se houver comentado)
}

Retorne APENAS um array JSON puro, sem markdown (\`\`\`json).

TEXTO:
${pdfText.slice(0, 50000)}`
                }
            ],
            response_format: { type: "json_object" }, // Garante JSON válido
            temperature: 0.2, // Mais preciso
        });

        const contentText = completion.choices[0].message.content;

        // Tenta extrair JSON caso venha com texto extra (embora response_format evite isso)
        let extractedQuestions = [];
        try {
            // O modo json_object do GPT-4o pode retornar um objeto { "questions": [...] } ou apenas array dependendo do prompt
            // Vamos garantir o parse
            const parsed = JSON.parse(contentText || '[]');

            if (Array.isArray(parsed)) {
                extractedQuestions = parsed;
            } else if (parsed.questions && Array.isArray(parsed.questions)) {
                extractedQuestions = parsed.questions;
            } else {
                // Tenta achar array dentro das chaves
                const values = Object.values(parsed);
                const arrayFound = values.find(v => Array.isArray(v));
                if (arrayFound) extractedQuestions = arrayFound as any[];
            }

            if (extractedQuestions.length === 0) throw new Error('Nenhuma questão encontrada no JSON.');

        } catch (e) {
            console.error('JSON Parse Error:', contentText);
            throw new Error('Falha ao processar resposta da IA.');
        }

        console.log(`  ✅ ${extractedQuestions.length} questões identificadas pela IA`);

        // Detectar metadados básicos pelo nome do arquivo
        const filename = file.name.toLowerCase();

        // Log Usage
        const usage = completion.usage || { prompt_tokens: 0, completion_tokens: 0 };
        try {
            const { aiTracker } = await import('@/lib/ai-tracker');
            await aiTracker.logUsage({
                provider: 'openai',
                model: 'gpt-4o',
                tokensInput: usage.prompt_tokens || 0,
                tokensOutput: usage.completion_tokens || 0,
                context: `ingest_pdf: ${filename}`,
                userId: undefined // Admin action
            });
        } catch (e) {
            console.error('Tracker error', e);
        }

        // 4. Salvar no Banco
        const supabase = createServerClient();

        let institution = 'Outras';
        if (filename.includes('enare')) institution = 'ENARE';
        else if (filename.includes('usp')) institution = 'USP';
        else if (filename.includes('unicamp')) institution = 'UNICAMP';

        const questionsToInsert = extractedQuestions.map((q: any) => ({
            institution,
            year: new Date().getFullYear(), // Default current year if not detected
            area: q.area || 'Geral',
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            option_e: q.option_e,
            correct_answer: q.correct_answer || 'A',
            explanation: q.explanation
        }));

        const { error } = await supabase.from('questions').insert(questionsToInsert);

        if (error) throw error;

        return { success: true, count: questionsToInsert.length };

    } catch (error: any) {
        console.error('Ingest Error:', error);
        return { success: false, error: error.message };
    }
}
