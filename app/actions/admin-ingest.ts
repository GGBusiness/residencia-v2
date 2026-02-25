'use server';

import { query } from '@/lib/db';

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
        const pdfParseModule: any = await import('pdf-parse');
        let pdfParse = pdfParseModule.default || pdfParseModule;
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
                    content: "Você é um especialista em extrair questões de provas médicas. Retorne APENAS um JSON válido. Distribua o gabarito entre A, B, C, D e E."
                },
                {
                    role: "user",
                    content: `EXTRAIA AS QUESTÕES DESTE TEXTO.
Para cada questão, retorne JSON com:
{
    "stem": "texto do enunciado",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "option_e": "..." (ou null),
    "correct_option": "C" (distribua entre A-E, NÃO coloque sempre A),
    "area": "Clinica Medica" (detecte pelo contexto),
    "explanation": "Explicação médica detalhada"
}

Retorne { "questions": [...] } como JSON.

TEXTO:
${pdfText.slice(0, 50000)}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });

        const contentText = completion.choices[0].message.content;

        let extractedQuestions = [];
        try {
            const parsed = JSON.parse(contentText || '{}');
            if (Array.isArray(parsed)) extractedQuestions = parsed;
            else if (parsed.questions && Array.isArray(parsed.questions)) extractedQuestions = parsed.questions;
            else {
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

        // Log Usage
        const usage = completion.usage || { prompt_tokens: 0, completion_tokens: 0 };
        try {
            const { aiTracker } = await import('@/lib/ai-tracker');
            await aiTracker.logUsage({
                provider: 'openai',
                model: 'gpt-4o',
                tokensInput: usage.prompt_tokens || 0,
                tokensOutput: usage.completion_tokens || 0,
                context: `ingest_pdf: ${file.name}`,
                userId: undefined
            });
        } catch (e) {
            console.error('Tracker error', e);
        }

        // 4. Primeiro criar o documento no DigitalOcean
        const filename = file.name.toLowerCase();
        let institution = 'Outras';
        if (filename.includes('enare')) institution = 'ENARE';
        else if (filename.includes('usp')) institution = 'USP-SP';
        else if (filename.includes('unicamp')) institution = 'UNICAMP';

        const yearMatch = file.name.match(/20(\d{2})/);
        const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : new Date().getFullYear();

        const { rows: docRows } = await query(`
            INSERT INTO documents (title, type, institution, year, processed)
            VALUES ($1, 'PROVA', $2, $3, TRUE)
            RETURNING id
        `, [file.name, institution, year]);

        const docId = docRows[0].id;

        // 5. Salvar questões no DigitalOcean com colunas corretas
        let savedCount = 0;
        for (const q of extractedQuestions) {
            const stem = q.stem || q.question_text || '';
            if (!stem || stem.length < 20) continue;

            let correctOpt = (q.correct_option || q.correct_answer || 'A').toString().toUpperCase().replace(/[^A-E]/g, '');
            if (!correctOpt || correctOpt.length !== 1) correctOpt = 'A';

            await query(`
                INSERT INTO questions (document_id, stem, option_a, option_b, option_c, option_d, option_e, correct_option, explanation, area)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                docId,
                stem,
                q.option_a || '',
                q.option_b || '',
                q.option_c || '',
                q.option_d || '',
                q.option_e || null,
                correctOpt,
                q.explanation || 'Gerado via IA',
                q.area || 'Geral'
            ]);
            savedCount++;
        }

        return { success: true, count: savedCount };

    } catch (error: any) {
        console.error('Ingest Error:', error);
        return { success: false, error: error.message };
    }
}
