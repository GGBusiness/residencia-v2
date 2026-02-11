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

        // 3. Enviar para Claude (Anthropic) para extração
        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        if (!ANTHROPIC_API_KEY) throw new Error('Chave da Anthropic não configurada.');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 4096,
                messages: [{
                    role: 'user',
                    content: `Você é um especialista em extrair questões de provas médicas.
EXTRAIA AS QUESTÕES DESTE TEXTO.
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

Retorne APENAS um array JSON.

TEXTO:
${pdfText.slice(0, 50000)}`
                }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Erro na API Anthropic: ${errText}`);
        }

        const apiData = await response.json();
        const contentText = apiData.content[0].text;
        const jsonMatch = contentText.match(/\[[\s\S]*\]/);

        if (!jsonMatch) throw new Error('IA não retornou JSON válido.');

        const extractedQuestions = JSON.parse(jsonMatch[0]);
        console.log(`  ✅ ${extractedQuestions.length} questões identificadas pela IA`);

        // Detectar metadados básicos pelo nome do arquivo
        const filename = file.name.toLowerCase();

        // Log Usage
        const usage = apiData.usage || { input_tokens: 0, output_tokens: 0 };
        try {
            // Dynamically import tracker to avoid build issues if file not found during static analysis?
            // improved: regular import since we created the file
            const { aiTracker } = await import('@/lib/ai-tracker');
            await aiTracker.logUsage({
                provider: 'anthropic',
                model: 'claude-3-haiku-20240307',
                tokensInput: usage.input_tokens || 0,
                tokensOutput: usage.output_tokens || 0,
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
