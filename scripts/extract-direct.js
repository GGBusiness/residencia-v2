// Extrator de questões DIRETO do PDF - SEM IA
// Usa pdfjs-dist para extrair texto e regex para identificar questões
const fs = require('fs');
const path = require('path');

// Importar pdfjs-dist dinamicamente
async function extractPdf(pdfPath) {
    console.log(`\n🚀 EXTRAÇÃO DIRETA: ${path.basename(pdfPath)}\n`);

    if (!fs.existsSync(pdfPath)) {
        console.error('❌ Arquivo não encontrado');
        process.exit(1);
    }

    // Carregar pdf.js
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    // Ler PDF
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    console.log(`📄 ${pdf.numPages} páginas`);

    // Extrair texto de todas as páginas
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
        process.stdout.write(`\r   Página ${i}/${pdf.numPages}`);
    }
    console.log(' ✅\n');

    // Salvar texto bruto
    fs.writeFileSync('pdf-texto-bruto.txt', fullText);
    console.log('💾 Texto salvo: pdf-texto-bruto.txt');
    console.log(`📊 ${fullText.length} caracteres\n`);

    // Detectar instituição/ano
    const filename = path.basename(pdfPath).toLowerCase();
    let institution = 'ENARE', year = 2024;
    if (filename.includes('unicamp')) institution = 'UNICAMP';
    else if (filename.includes('usp')) institution = 'USP';
    else if (filename.includes('unifesp')) institution = 'UNIFESP';
    else if (filename.includes('iscmsp')) institution = 'ISCMSP';
    else if (filename.includes('sus')) institution = 'SUS-SP';
    else if (filename.includes('psu')) institution = 'PSU-MG';
    const yearMatch = filename.match(/20(\d{2})/);
    if (yearMatch) year = parseInt(yearMatch[0]);

    console.log(`🏥 ${institution} ${year}\n`);

    // PARSER DE QUESTÕES
    // Padrões comuns em provas de residência:
    // - "QUESTÃO 1" ou "Questão 01" ou "1." ou "1)" no início
    // - Alternativas: (A), (B), (C), (D), (E) ou a), b), c), d), e) ou A., B., C., D., E.

    const questions = [];

    // Tentar diferentes padrões de questão
    const patterns = [
        // QUESTÃO N ou Questão N
        /(?:QUEST[ÃA]O|Quest[ãa]o)\s*(\d+)[.:)]*\s*([\s\S]*?)(?=(?:QUEST[ÃA]O|Quest[ãa]o)\s*\d+|$)/gi,
        // N. ou N) no início de linha
        /(?:^|\n)\s*(\d+)\s*[.)]\s+([\s\S]*?)(?=(?:^|\n)\s*\d+\s*[.)]|$)/g,
    ];

    let matched = false;

    for (const pattern of patterns) {
        const matches = [...fullText.matchAll(pattern)];
        if (matches.length > 5) {
            console.log(`📋 Padrão encontrado: ${matches.length} questões potenciais\n`);

            for (const match of matches) {
                const num = parseInt(match[1]);
                const content = match[2].trim();

                if (content.length < 50) continue; // Muito curto

                // Tentar extrair alternativas
                const altPatterns = [
                    /\(([A-E])\)\s*(.*?)(?=\([A-E]\)|$)/gi,
                    /([A-E])\)\s*(.*?)(?=[A-E]\)|$)/gi,
                    /([A-E])\.\s*(.*?)(?=[A-E]\.|$)/gi,
                ];

                let alternatives = {};
                let questionText = content;

                for (const altPattern of altPatterns) {
                    const altMatches = [...content.matchAll(altPattern)];
                    if (altMatches.length >= 4) {
                        for (const alt of altMatches) {
                            const letter = alt[1].toUpperCase();
                            alternatives[letter] = alt[2].trim();
                        }
                        // Texto da questão é o que vem antes da primeira alternativa
                        const firstAltPos = content.search(altPattern);
                        if (firstAltPos > 0) {
                            questionText = content.slice(0, firstAltPos).trim();
                        }
                        break;
                    }
                }

                if (Object.keys(alternatives).length >= 4 && questionText.length > 30) {
                    questions.push({
                        numero: num,
                        texto_questao: questionText,
                        alternativa_a: alternatives['A'] || '',
                        alternativa_b: alternatives['B'] || '',
                        alternativa_c: alternatives['C'] || '',
                        alternativa_d: alternatives['D'] || '',
                        alternativa_e: alternatives['E'] || null,
                        gabarito: null, // Precisaria do gabarito separado
                        area: 'Todas as áreas',
                        dificuldade: 'media'
                    });
                }
            }
            matched = true;
            break;
        }
    }

    if (!matched || questions.length === 0) {
        console.log('⚠️ Nenhum padrão de questão reconhecido');
        console.log('💡 Verifique o arquivo pdf-texto-bruto.txt para analisar o formato');
        return;
    }

    console.log(`✅ ${questions.length} questões extraídas!\n`);

    // Gerar SQL
    const sqlFile = `import-${institution.toLowerCase()}-${year}-direto.sql`;
    let sql = `-- ${institution} ${year} - ${questions.length} questões (Extração Direta)\n\n`;

    for (const q of questions) {
        const esc = s => String(s || '').replace(/'/g, "''");
        sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${esc(q.area)}', NULL, '${q.dificuldade}', '${esc(q.texto_questao)}', '${esc(q.alternativa_a)}', '${esc(q.alternativa_b)}', '${esc(q.alternativa_c)}', '${esc(q.alternativa_d)}', ${q.alternativa_e ? `'${esc(q.alternativa_e)}'` : 'NULL'}, '${q.gabarito || 'A'}');\n`;
    }

    fs.writeFileSync(sqlFile, sql);
    fs.writeFileSync(`${institution.toLowerCase()}-${year}-direto.json`, JSON.stringify(questions, null, 2));

    console.log(`💾 Salvos: ${sqlFile}`);
    console.log(`💾 JSON: ${institution.toLowerCase()}-${year}-direto.json`);
    console.log('\n🎉 Concluído!');
}

// Executar
const pdfPath = process.argv[2];
if (!pdfPath) {
    console.error('❌ Uso: node extract-direct.js <caminho-do-pdf>');
    process.exit(1);
}

extractPdf(pdfPath).catch(e => {
    console.error('❌ Erro:', e.message);
    process.exit(1);
});
