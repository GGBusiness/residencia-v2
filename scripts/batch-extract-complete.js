// LOTE COMPLETO: Processa TODOS os PDFs recursivamente com padrões melhorados
const fs = require('fs');
const path = require('path');

const BASE_DIR = 'c:\\Geral\\Alice\\Provas Antigas';

// Encontrar todos os PDFs recursivamente
function findAllPdfs(dir, pdfs = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findAllPdfs(fullPath, pdfs);
        } else if (file.endsWith('.pdf')) {
            pdfs.push(fullPath);
        }
    }
    return pdfs;
}

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

        // Detectar instituição/ano/área
        const lower = filename.toLowerCase();
        const dirName = path.dirname(pdfPath).toLowerCase();

        let institution = 'ENARE', year = 2024, area = 'Todas as áreas';

        // Instituição
        if (lower.includes('unicamp')) institution = 'UNICAMP';
        else if (lower.includes('usp')) institution = 'USP';
        else if (lower.includes('unifesp')) institution = 'UNIFESP';
        else if (lower.includes('iscmsp')) institution = 'ISCMSP';
        else if (lower.includes('sus')) institution = 'SUS-SP';
        else if (lower.includes('psu')) institution = 'PSU-MG';
        else if (lower.includes('unesp')) institution = 'UNESP';
        else if (lower.includes('ufes')) institution = 'UFES';
        else if (lower.includes('ufrj')) institution = 'UFRJ';
        else if (dirName.includes('estrategia')) institution = 'Estratégia MED';

        // Ano
        const yearMatch = lower.match(/20(\d{2})/);
        if (yearMatch) year = parseInt(yearMatch[0]);

        // Área (para banco de questões por matéria)
        if (dirName.includes('oftalmologia')) area = 'Oftalmologia';
        else if (dirName.includes('otorrin')) area = 'Otorrinolaringologia';
        else if (lower.includes('cg') || lower.includes('cirurgia')) area = 'Cirurgia';
        else if (lower.includes('cm') || lower.includes('clinica')) area = 'Clínica Médica';
        else if (lower.includes('go') || lower.includes('gineco')) area = 'GO';
        else if (lower.includes('ped')) area = 'Pediatria';

        const questions = [];

        // PADRÕES DE QUESTÃO (múltiplos formatos)
        const questionPatterns = [
            // QUESTÃO N ou Questão N
            /(?:QUEST[ÃA]O|Quest[ãa]o)\s*(\d+)[.:)]*\s*([\s\S]*?)(?=(?:QUEST[ÃA]O|Quest[ãa]o)\s*\d+|$)/gi,
            // N. ou N) no início
            /(?:^|\n)\s*(\d+)\s*[.)]\s+([\s\S]*?)(?=(?:^|\n)\s*\d+\s*[.)]|$)/g,
            // (Estratégia) Geralmente tem "Questão N" ou "(Ano/Prova)" antes
            /(\d+)\s*[-–]\s*([\s\S]*?)(?=\d+\s*[-–]|$)/g,
        ];

        // PADRÕES DE ALTERNATIVA
        const altPatterns = [
            /\(([A-E])\)\s*(.*?)(?=\([A-E]\)|$)/gi,
            /([A-E])\)\s*(.*?)(?=[A-E]\)|$)/gi,
            /([A-E])\.\s*(.*?)(?=[A-E]\.|$)/gi,
            /\n\s*([a-e])\)\s*(.*?)(?=\n\s*[a-e]\)|$)/gi,
        ];

        for (const pattern of questionPatterns) {
            const matches = [...fullText.matchAll(pattern)];
            if (matches.length >= 3) {
                for (const match of matches) {
                    const num = parseInt(match[1]);
                    const content = match[2].trim();
                    if (content.length < 30) continue;

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

                    if (Object.keys(alternatives).length >= 4 && questionText.length > 20) {
                        questions.push({
                            numero: num,
                            institution,
                            year,
                            area,
                            texto_questao: questionText,
                            alternativa_a: alternatives['A'] || '',
                            alternativa_b: alternatives['B'] || '',
                            alternativa_c: alternatives['C'] || '',
                            alternativa_d: alternatives['D'] || '',
                            alternativa_e: alternatives['E'] || null,
                            gabarito: null,
                            dificuldade: 'media'
                        });
                    }
                }
                if (questions.length > 0) break;
            }
        }

        console.log(`   ✅ ${questions.length} questões (${institution}, ${area})`);
        return questions;

    } catch (e) {
        console.log(`   ❌ ${e.message.slice(0, 50)}`);
        return [];
    }
}

async function main() {
    console.log('🚀 PROCESSAMENTO COMPLETO - TODOS OS PDFs\n');

    const allPdfs = findAllPdfs(BASE_DIR);
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
    console.log(`✅ PDFs com questões: ${successCount}/${allPdfs.length}`);
    console.log(`📝 Total de questões: ${allQuestions.length}`);

    if (allQuestions.length > 0) {
        fs.writeFileSync('all-questions-complete.json', JSON.stringify(allQuestions, null, 2));
        console.log(`\n💾 JSON: all-questions-complete.json`);
    }

    console.log('\n🎉 Concluído!');
}

main().catch(console.error);
