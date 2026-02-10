import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY não configurada no .env.local');
    process.exit(1);
}

const pdfPath = process.argv[2];

if (!pdfPath) {
    console.error('❌ Uso: npx tsx extract-single-pdf.ts <caminho-do-pdf>');
    process.exit(1);
}

async function extractQuestions() {
    console.log(`\n🚀 Processando: ${path.basename(pdfPath)}\n`);

    // Detectar instituição e ano do nome do arquivo
    const filename = path.basename(pdfPath).toLowerCase();
    let institution = 'ENARE';
    let year = 2024;

    if (filename.includes('2021')) year = 2021;
    if (filename.includes('2022')) year = 2022;
    if (filename.includes('2023')) year = 2023;
    if (filename.includes('2024')) year = 2024;
    if (filename.includes('2025')) year = 2025;

    console.log(`📋 Instituição: ${institution} | Ano: ${year}\n`);

    // Ler PDF
    console.log('📄 Lendo PDF...');
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    const pdfText = data.text;

    console.log(`✅ ${pdfText.length} caracteres extraídos\n`);

    // Limitar tamanho (max 100k caracteres = ~25k tokens)
    const textChunk = pdfText.slice(0, 100000);

    console.log('🤖 Enviando para Claude API...\n');

    // Chamar Claude
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

TAREFA: Extraia TODAS as questões de múltipla escolha do texto abaixo.

Para cada questão, retorne no formato JSON:
{
    "numero": 1,
    "texto_questao": "enunciado completo da questão",
    "alternativa_a": "texto da alternativa A",
    "alternativa_b": "texto da alternativa B", 
    "alternativa_c": "texto da alternativa C",
    "alternativa_d": "texto da alternativa D",
    "alternativa_e": "texto da alternativa E ou null se não houver",
    "area": "Cirurgia" | "Clínica Médica" | "GO" | "Pediatria" | "Medicina Preventiva" | "Todas as áreas",
    "subarea": "subárea específica ou null",
    "dificuldade": "facil" | "media" | "dificil"
}

INSTRUÇÕES:
- Retorne APENAS um array JSON válido
- Mantenha o texto completo e correto
- Se não conseguir classificar a área, use "Todas as áreas"
- Não invente informações

TEXTO DA PROVA:
${textChunk}`
            }]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro na API: ${response.status} - ${error}`);
    }

    const result = await response.json();
    const responseText = result.content[0].text;

    // Extrair JSON
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        console.log('❌ Claude não retornou JSON válido');
        console.log('Resposta:', responseText.slice(0, 500));
        return;
    }

    const questions = JSON.parse(jsonMatch[0]);
    console.log(`✅ ${questions.length} questões extraídas!\n`);

    // Gerar SQL
    console.log('📝 Gerando SQL...\n');

    const outputFilename = `import-${institution.toLowerCase()}-${year}.sql`;
    const outputPath = path.join(process.cwd(), outputFilename);

    let sql = `-- ========================================\n`;
    sql += `-- Questões ${institution} ${year}\n`;
    sql += `-- Extraídas automaticamente com Claude API\n`;
    sql += `-- Total: ${questions.length} questões\n`;
    sql += `-- ========================================\n\n`;

    questions.forEach((q: any, index: number) => {
        const text = (q.texto_questao || '').replace(/'/g, "''");
        const optA = (q.alternativa_a || '').replace(/'/g, "''");
        const optB = (q.alternativa_b || '').replace(/'/g, "''");
        const optC = (q.alternativa_c || '').replace(/'/g, "''");
        const optD = (q.alternativa_d || '').replace(/'/g, "''");
        const optE = q.alternativa_e ? `'${q.alternativa_e.replace(/'/g, "''")}'` : 'NULL';
        const area = q.area || 'Todas as áreas';
        const subarea = q.subarea ? `'${q.subarea.replace(/'/g, "''")}'` : 'NULL';
        const diff = q.dificuldade || 'media';

        sql += `-- Questão ${index + 1}\n`;
        sql += `INSERT INTO questions (\n`;
        sql += `  institution, year, area, subarea, difficulty,\n`;
        sql += `  question_text, option_a, option_b, option_c, option_d, option_e,\n`;
        sql += `  correct_answer\n`;
        sql += `) VALUES (\n`;
        sql += `  '${institution}', ${year}, '${area}', ${subarea}, '${diff}',\n`;
        sql += `  '${text}',\n`;
        sql += `  '${optA}',\n`;
        sql += `  '${optB}',\n`;
        sql += `  '${optC}',\n`;
        sql += `  '${optD}',\n`;
        sql += `  ${optE},\n`;
        sql += `  'A'\n`;
        sql += `);\n\n`;
    });

    fs.writeFileSync(outputPath, sql, 'utf-8');

    console.log('═══════════════════════════════════════');
    console.log('✅ CONCLUÍDO!\n');
    console.log(`📁 Arquivo gerado: ${outputFilename}`);
    console.log(`📊 Total de questões: ${questions.length}`);
    console.log(`\n💡 Execute no Supabase SQL Editor para importar!\n`);
}

extractQuestions().catch(error => {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
});
