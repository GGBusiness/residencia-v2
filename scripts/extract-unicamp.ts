import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const pdfPath = 'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\prova-residencia-medica-unicamp-manha-tarde-r1-2026.pdf';

async function extractQuestionsManually() {
    console.log('📄 Lendo PDF da UNICAMP 2026...\n');

    // Ler PDF
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const pdfText = data.text;

    console.log(`✅ PDF lido: ${pdfText.length} caracteres\n`);
    console.log('🤖 Enviando para Claude API...\n');

    // Chamar Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-3-sonnet-20240229', // Modelo mais poderoso
            max_tokens: 8000,
            messages: [{
                role: 'user',
                content: `Você é um especialista em extrair questões de provas médicas.

IMPORTANTE: Extraia TODAS as questões do texto abaixo no formato JSON exato.

Para cada questão, retorne:
{
    "numero": 1,
    "texto_questao": "texto completo da questão com todo o enunciado",
    "alternativa_a": "texto da alternativa A",
    "alternativa_b": "texto da alternativa B",
    "alternativa_c": "texto da alternativa C",
    "alternativa_d": "texto da alternativa D",
    "alternativa_e": "texto da alternativa E (ou null se não houver)",
    "area": "Cirurgia" | "Clínica Médica" | "GO" | "Pediatria" | "Medicina Preventiva",
    "subarea": "subárea específica (ex: Trauma, Cardiologia, Obstetrícia, etc)",
    "dificuldade": "facil" | "media" | "dificil"
}

Retorne APENAS um array JSON válido, sem texto adicional.

TEXTO DA PROVA:
${pdfText.slice(0, 80000)}`
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`Erro na API: ${response.status} - ${await response.text()}`);
    }

    const result = await response.json();
    const responseText = result.content[0].text;

    // Extrair JSON
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        console.log('❌ Claude não retornou JSON');
        console.log('Resposta:', responseText);
        return;
    }

    const questions = JSON.parse(jsonMatch[0]);
    console.log(`✅ ${questions.length} questões extraídas!\n`);

    // Gerar SQL
    let sql = `-- Questões UNICAMP 2026 - Extraídas automaticamente com Claude\n-- Total: ${questions.length} questões\n\n`;

    questions.forEach((q: any) => {
        const text = q.texto_questao.replace(/'/g, "''");
        const optA = q.alternativa_a.replace(/'/g, "''");
        const optB = q.alternativa_b.replace(/'/g, "''");
        const optC = q.alternativa_c.replace(/'/g, "''");
        const optD = q.alternativa_d.replace(/'/g, "''");
        const optE = q.alternativa_e ? `'${q.alternativa_e.replace(/'/g, "''")}'` : 'NULL';

        sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer)\nVALUES ('UNICAMP', 2026, '${q.area}', '${q.subarea}', '${q.dificuldade}', '${text}', '${optA}', '${optB}', '${optC}', '${optD}', ${optE}, 'A');\n\n`;
    });

    // Salvar arquivo
    const outputPath = 'c:\\Geral\\Alice\\Provas Antigas\\APP\\residencia-app\\import-unicamp-2026.sql';
    fs.writeFileSync(outputPath, sql);

    console.log('✅ SQL gerado com sucesso!');
    console.log(`📁 Arquivo: ${outputPath}`);
    console.log(`\n🎉 Agora execute o SQL no Supabase para importar as ${questions.length} questões!`);
}

extractQuestionsManually().catch(console.error);
