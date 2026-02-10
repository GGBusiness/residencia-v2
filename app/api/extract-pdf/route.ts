import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('pdf') as File;

        if (!file) {
            return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
        }

        // Converter PDF para buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Usar pdf-parse (com fallback)
        let pdfText = '';
        try {
            const pdfParse = require('pdf-parse');
            const data = await pdfParse(buffer);
            pdfText = data.text;
        } catch (e) {
            // Se pdf-parse falhar, retorna erro para usar copy/paste
            return NextResponse.json({
                error: 'Erro ao processar PDF. Use copy/paste do texto.',
                needsCopyPaste: true
            }, { status: 422 });
        }

        // Detectar instituição e ano
        const filename = file.name.toLowerCase();
        let institution = 'ENARE';
        let year = 2024;

        if (filename.includes('unicamp')) institution = 'UNICAMP';
        if (filename.includes('usp')) institution = 'USP';
        if (filename.includes('unifesp')) institution = 'UNIFESP';
        if (filename.includes('sus-sp')) institution = 'SUS-SP';

        if (filename.includes('2021')) year = 2021;
        if (filename.includes('2022')) year = 2022;
        if (filename.includes('2023')) year = 2023;
        if (filename.includes('2024')) year = 2024;
        if (filename.includes('2025')) year = 2025;
        if (filename.includes('2026')) year = 2026;

        // Chamar Claude API
        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

        if (!ANTHROPIC_API_KEY) {
            return NextResponse.json({ error: 'API Key não configurada' }, { status: 500 });
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 8000,
                messages: [{
                    role: 'user',
                    content: `Você é um especialista em extrair questões de provas médicas.

Extraia TODAS as questões de múltipla escolha do texto abaixo.

Para cada questão, retorne no formato JSON:
{
    "numero": 1,
    "texto_questao": "enunciado completo",
    "alternativa_a": "texto da alternativa A",
    "alternativa_b": "texto da alternativa B",
    "alternativa_c": "texto da alternativa C",
    "alternativa_d": "texto da alternativa D",
    "alternativa_e": "texto da alternativa E ou null",
    "area": "Cirurgia" | "Clínica Médica" | "GO" | "Pediatria" | "Medicina Preventiva" | "Todas as áreas",
    "subarea": "subárea específica ou null",
    "dificuldade": "facil" | "media" | "dificil"
}

Retorne APENAS um array JSON válido, sem texto adicional.

TEXTO DA PROVA:
${pdfText.slice(0, 100000)}`
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            return NextResponse.json({ error: `Erro na API do Claude: ${error}` }, { status: 500 });
        }

        const result = await response.json();
        const responseText = result.content[0].text;

        // Extrair JSON
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return NextResponse.json({
                error: 'Claude não conseguiu extrair questões',
                claudeResponse: responseText.slice(0, 500)
            }, { status: 422 });
        }

        const questions = JSON.parse(jsonMatch[0]);

        // Gerar SQL
        let sql = `-- ========================================\n`;
        sql += `-- Questões ${institution} ${year}\n`;
        sql += `-- Arquivo: ${file.name}\n`;
        sql += `-- Total: ${questions.length} questões\n`;
        sql += `-- ========================================\n\n`;

        questions.forEach((q: any, index: number) => {
            const text = (q.texto_questao || '').replace(/'/g, "''");
            const optA = (q.alternativa_a || '').replace(/'/g, "''");
            const optB = (q.alternativa_b || '').replace(/'/g, "''");
            const optC = (q.alternativa_c || '').replace(/'/g, "''");
            const optD = (q.alternativa_d || '').replace(/'/g, "''");
            const optE = q.alternativa_e ? `'${q.alternativa_e.replace(/'/g, "''")}'` : 'NULL';
            const area = (q.area || 'Todas as áreas').replace(/'/g, "''");
            const subarea = q.subarea ? `'${q.subarea.replace(/'/g, "''")}'` : 'NULL';
            const diff = q.dificuldade || 'media';

            sql += `-- Questão ${index + 1}\n`;
            sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer)\n`;
            sql += `VALUES ('${institution}', ${year}, '${area}', ${subarea}, '${diff}', '${text}', '${optA}', '${optB}', '${optC}', '${optD}', ${optE}, 'A');\n\n`;
        });

        return NextResponse.json({
            success: true,
            institution,
            year,
            questionCount: questions.length,
            sql,
            filename: `import-${institution.toLowerCase()}-${year}.sql`
        });

    } catch (error: any) {
        console.error('Erro no processamento:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
