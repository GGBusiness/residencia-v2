import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Question {
    institution: string;
    year: number;
    area: string;
    subarea?: string;
    difficulty?: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    option_e?: string | null;
    correct_answer: string;
    explanation?: string;
}

function detectArea(filename: string): string {
    const lower = filename.toLowerCase();

    if (lower.includes('cirurgia') || lower.includes('-cir-') || lower.includes('r-cir')) return 'Cirurgia';
    if (lower.includes('clinica') || lower.includes('-cm-') || lower.includes('r3cm')) return 'Clínica Médica';
    if (lower.includes('gineco') || lower.includes('-go-') || lower.includes('r-go')) return 'GO';
    if (lower.includes('pediatria') || lower.includes('-ped-') || lower.includes('r-ped')) return 'Pediatria';
    if (lower.includes('preventiva')) return 'Medicina Preventiva';

    return 'Todas as áreas';
}

function detectInstitution(filename: string): string {
    const lower = filename.toLowerCase();

    if (lower.includes('enare')) return 'ENARE';
    if (lower.includes('usp')) return 'USP';
    if (lower.includes('unicamp')) return 'UNICAMP';
    if (lower.includes('unifesp')) return 'UNIFESP';
    if (lower.includes('unesp')) return 'UNESP';
    if (lower.includes('sus-sp') || lower.includes('sussp')) return 'SUS-SP';
    if (lower.includes('iscmsp')) return 'ISCMSP';
    if (lower.includes('psu')) return 'PSU-MG';
    if (lower.includes('ufes')) return 'UFES';
    if (lower.includes('ufrj')) return 'UFRJ';

    return 'Outras';
}

function detectYear(filename: string): number {
    const yearMatch = filename.match(/20(\d{2})/);
    return yearMatch ? parseInt(`20${yearMatch[1]}`) : 2024;
}

async function extractQuestionsFromPDF(pdfPath: string): Promise<Question[]> {
    console.log(`📄 Processando: ${path.basename(pdfPath)}`);

    try {
        // Carregar pdf-parse
        const pdfParse = (await import('pdf-parse')).default as any;

        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        const text: string = data.text;

        const filename = path.basename(pdfPath);
        const institution = detectInstitution(filename);
        const year = detectYear(filename);
        const area = detectArea(filename);

        const questions: Question[] = [];

        // Regex mais simples: buscar números seguidos de ponto
        const lines = text.split('\n');
        let currentQuestion: any = null;
        let currentOption: string = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detectar início de questão (número + ponto)
            const questionMatch = line.match(/^(\d{1,3})\s*[.-]\s*(.+)/);
            if (questionMatch && currentQuestion) {
                // Salvar questão anterior
                if (currentQuestion.text && currentQuestion.options.A) {
                    questions.push({
                        institution,
                        year,
                        area,
                        question_text: currentQuestion.text,
                        option_a: currentQuestion.options.A || '',
                        option_b: currentQuestion.options.B || '',
                        option_c: currentQuestion.options.C || '',
                        option_d: currentQuestion.options.D || '',
                        option_e: currentQuestion.options.E || null,
                        correct_answer: 'A',
                        difficulty: 'media',
                    });
                }
                currentQuestion = { text: questionMatch[2], options: {} };
            } else if (questionMatch) {
                currentQuestion = { text: questionMatch[2], options: {} };
            }

            // Detectar alternativas
            const optionMatch = line.match(/^([A-E])\s*[.)]\s*(.+)/);
            if (optionMatch && currentQuestion) {
                currentQuestion.options[optionMatch[1]] = optionMatch[2];
            } else if (currentQuestion && line.length > 0) {
                // Continuar texto da questão ou alternativa
                if (currentOption && line.match(/^[a-z]/)) {
                    currentQuestion.options[currentOption] += ' ' + line;
                } else if (!line.match(/^[A-E]\s*[.)]/) && currentQuestion.text) {
                    currentQuestion.text += ' ' + line;
                }
            }

            if (optionMatch) {
                currentOption = optionMatch[1];
            }
        }

        // Salvar última questão
        if (currentQuestion?.text && currentQuestion.options.A) {
            questions.push({
                institution,
                year,
                area,
                question_text: currentQuestion.text,
                option_a: currentQuestion.options.A || '',
                option_b: currentQuestion.options.B || '',
                option_c: currentQuestion.options.C || '',
                option_d: currentQuestion.options.D || '',
                option_e: currentQuestion.options.E || null,
                correct_answer: 'A',
                difficulty: 'media',
            });
        }

        console.log(`  ✅ ${questions.length} questões extraídas`);
        return questions.filter(q =>
            q.option_a && q.option_b && q.option_c && q.option_d &&
            q.question_text.length > 30
        );
    } catch (error) {
        console.error(`  ❌ Erro: ${error}`);
        return [];
    }
}

async function importToSupabase(questions: Question[], batchSize = 50) {
    console.log(`\n📊 Importando ${questions.length} questões para Supabase...`);

    let imported = 0;

    for (let i = 0; i < questions.length; i += batchSize) {
        const batch = questions.slice(i, i + batchSize);

        try {
            const { error } = await supabase
                .from('questions')
                .insert(batch);

            if (error) {
                console.error(`❌ Erro no lote ${Math.floor(i / batchSize) + 1}:`, error.message);
            } else {
                imported += batch.length;
                console.log(`  ✅ Lote ${Math.floor(i / batchSize) + 1}: ${imported}/${questions.length}`);
            }
        } catch (err) {
            console.error(`❌ Erro:`, err);
        }
    }

    console.log(`\n📈 Importadas: ${imported} questões`);
}

async function main() {
    console.log('🚀 Iniciando importação COMPLETA de questões...\n');

    const rootDir = 'c:\\Geral\\Alice\\Provas Antigas';

    // Buscar TODOS os PDFs recursivamente
    function findPDFs(dir: string, maxDepth = 3, currentDepth = 0): string[] {
        if (currentDepth >= maxDepth) return [];

        const pdfs: string[] = [];
        try {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory() && !item.includes('node_modules')) {
                    pdfs.push(...findPDFs(fullPath, maxDepth, currentDepth + 1));
                } else if (item.toLowerCase().endsWith('.pdf') && !item.toLowerCase().includes('gabarito')) {
                    pdfs.push(fullPath);
                }
            }
        } catch (error) { }

        return pdfs;
    }

    const allPDFs = findPDFs(rootDir);
    const priorityPDFs = allPDFs.filter(pdf => {
        const name = path.basename(pdf).toLowerCase();
        return (
            name.includes('enare') ||
            name.includes('usp') ||
            name.includes('unicamp') ||
            name.includes('unifesp') ||
            name.includes('unesp') ||
            name.includes('sus-sp') ||
            name.includes('iscmsp') ||
            name.includes('psu') ||
            name.includes('ufes') ||
            name.includes('ufrj')
        );
    });

    console.log(`📚 PDFs encontrados: ${allPDFs.length}`);
    console.log(`🎯 PDFs de provas oficiais: ${priorityPDFs.length}\n`);

    const allQuestions: Question[] = [];

    for (const pdfPath of priorityPDFs) {
        const questions = await extractQuestionsFromPDF(pdfPath);
        allQuestions.push(...questions);
    }

    console.log(`\n✅ Total extraído: ${allQuestions.length} questões\n`);

    if (allQuestions.length > 0) {
        await importToSupabase(allQuestions);
    }

    console.log('\n🎉 Importação finalizada!');
}

main().catch(console.error);
