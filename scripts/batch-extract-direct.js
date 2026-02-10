// LOTE: Processa TODOS os PDFs com extração direta
const fs = require('fs');
const path = require('path');

const BASE_DIRS = [
    'c:\\Geral\\Alice\\Provas Antigas',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas'
];

async function extractPdf(pdfPath) {
    const filename = path.basename(pdfPath);
    console.log(`\n📄 ${filename}`);

    try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const data = new Uint8Array(fs.readFileSync(pdfPath));
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        // Extrair texto
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += content.items.map(item => item.str).join(' ') + '\n\n';
        }

        // Detectar instituição/ano
        const lower = filename.toLowerCase();
        let institution = 'ENARE', year = 2024;
        if (lower.includes('unicamp')) institution = 'UNICAMP';
        else if (lower.includes('usp')) institution = 'USP';
        else if (lower.includes('unifesp')) institution = 'UNIFESP';
        else if (lower.includes('iscmsp')) institution = 'ISCMSP';
        else if (lower.includes('sus')) institution = 'SUS-SP';
        else if (lower.includes('psu')) institution = 'PSU-MG';
        else if (lower.includes('unesp')) institution = 'UNESP';
        else if (lower.includes('ufes')) institution = 'UFES';
        else if (lower.includes('ufrj')) institution = 'UFRJ';
        const yearMatch = lower.match(/20(\d{2})/);
        if (yearMatch) year = parseInt(yearMatch[0]);

        // Parser de questões
        const questions = [];
        const patterns = [
            /(?:QUEST[ÃA]O|Quest[ãa]o)\s*(\d+)[.:)]*\s*([\s\S]*?)(?=(?:QUEST[ÃA]O|Quest[ãa]o)\s*\d+|$)/gi,
            /(?:^|\n)\s*(\d+)\s*[.)]\s+([\s\S]*?)(?=(?:^|\n)\s*\d+\s*[.)]|$)/g,
        ];

        for (const pattern of patterns) {
            const matches = [...fullText.matchAll(pattern)];
            if (matches.length > 5) {
                for (const match of matches) {
                    const num = parseInt(match[1]);
                    const content = match[2].trim();
                    if (content.length < 50) continue;

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
                                alternatives[alt[1].toUpperCase()] = alt[2].trim();
                            }
                            const firstAltPos = content.search(altPattern);
                            if (firstAltPos > 0) questionText = content.slice(0, firstAltPos).trim();
                            break;
                        }
                    }

                    if (Object.keys(alternatives).length >= 4 && questionText.length > 30) {
                        questions.push({
                            numero: num,
                            institution,
                            year,
                            texto_questao: questionText,
                            alternativa_a: alternatives['A'] || '',
                            alternativa_b: alternatives['B'] || '',
                            alternativa_c: alternatives['C'] || '',
                            alternativa_d: alternatives['D'] || '',
                            alternativa_e: alternatives['E'] || null,
                            gabarito: null,
                            area: 'Todas as áreas',
                            dificuldade: 'media'
                        });
                    }
                }
                break;
            }
        }

        console.log(`   ✅ ${questions.length} questões`);
        return questions;

    } catch (e) {
        console.log(`   ❌ ${e.message}`);
        return [];
    }
}

async function main() {
    console.log('🚀 PROCESSAMENTO EM LOTE - EXTRAÇÃO DIRETA\n');

    // Listar todos os PDFs
    const allPdfs = [];
    for (const dir of BASE_DIRS) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (file.endsWith('.pdf')) {
                allPdfs.push(path.join(dir, file));
            }
        }
    }

    console.log(`📋 ${allPdfs.length} PDFs encontrados\n`);

    let allQuestions = [];
    let successCount = 0;

    for (const pdf of allPdfs) {
        const questions = await extractPdf(pdf);
        if (questions.length > 0) {
            allQuestions.push(...questions);
            successCount++;
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 RESUMO`);
    console.log(`${'='.repeat(50)}`);
    console.log(`✅ PDFs processados: ${successCount}/${allPdfs.length}`);
    console.log(`📝 Total de questões: ${allQuestions.length}`);

    // Gerar SQL consolidado
    if (allQuestions.length > 0) {
        let sql = `-- Consolidado: ${allQuestions.length} questões\n-- Gerado: ${new Date().toISOString()}\n\n`;

        for (const q of allQuestions) {
            const esc = s => String(s || '').replace(/'/g, "''");
            sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${q.institution}', ${q.year}, '${esc(q.area)}', NULL, '${q.dificuldade}', '${esc(q.texto_questao)}', '${esc(q.alternativa_a)}', '${esc(q.alternativa_b)}', '${esc(q.alternativa_c)}', '${esc(q.alternativa_d)}', ${q.alternativa_e ? `'${esc(q.alternativa_e)}'` : 'NULL'}, '${q.gabarito || 'A'}');\n`;
        }

        fs.writeFileSync('import-all-direct.sql', sql);
        fs.writeFileSync('all-questions-direct.json', JSON.stringify(allQuestions, null, 2));

        console.log(`\n💾 SQL: import-all-direct.sql`);
        console.log(`💾 JSON: all-questions-direct.json`);
    }

    console.log('\n🎉 Concluído!');
}

main().catch(console.error);
