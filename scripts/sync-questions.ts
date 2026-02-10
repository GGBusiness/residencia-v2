import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
// @ts-ignore
import pdfParse from 'pdf-parse';
import { Readable } from 'stream';

// Configurar permissão TLS para dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: process.env.SPACES_ENDPOINT,
    credentials: {
        accessKeyId: process.env.SPACES_KEY!,
        secretAccessKey: process.env.SPACES_SECRET!
    }
});

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

// Logic extracted from import-questions.ts
function detectArea(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('cirurgia') || lower.includes('-cir-') || lower.includes('r-cir')) return 'Cirurgia Geral';
    if (lower.includes('clinica') || lower.includes('-cm-') || lower.includes('r3cm')) return 'Clínica Médica';
    if (lower.includes('gineco') || lower.includes('-go-') || lower.includes('r-go')) return 'Ginecologia e Obstetrícia';
    if (lower.includes('pediatria') || lower.includes('-ped-') || lower.includes('r-ped')) return 'Pediatria';
    if (lower.includes('preventiva')) return 'Medicina Preventiva';
    return 'Todas as áreas';
}

interface Question {
    institution: string;
    year: number;
    area: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    option_e?: string | null;
    correct_answer: string;
}

async function extractQuestionsFromText(text: string, filename: string): Promise<Question[]> {
    const institution = filename.toLowerCase().includes('enare') ? 'ENARE' :
        filename.toLowerCase().includes('usp') ? 'USP' : 'Outros';
    const yearMatch = filename.match(/20(\d{2})/);
    const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : 2024;
    const area = detectArea(filename);

    const questions: Question[] = [];
    const lines = text.split('\n');
    let currentQuestion: any = null;
    let currentOption: string = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Regex para detectar início de questão (ex: "1. Texto...")
        const questionMatch = line.match(/^(\d{1,3})[\s.-]+(.+)/);

        if (questionMatch) {
            // Se já tem uma questão sendo montada, salva ela
            if (currentQuestion && currentQuestion.text && currentQuestion.options.A) {
                questions.push({
                    institution, year, area,
                    question_text: currentQuestion.text,
                    option_a: currentQuestion.options.A || '',
                    option_b: currentQuestion.options.B || '',
                    option_c: currentQuestion.options.C || '',
                    option_d: currentQuestion.options.D || '',
                    option_e: currentQuestion.options.E || null,
                    correct_answer: 'A', // Default, gabarito seria separado
                });
            }
            // Começa nova questão
            currentQuestion = { text: questionMatch[2], options: {} };
            currentOption = '';
        } else if (currentQuestion) {
            // Detectar alternativas (A) ... B) ... etc)
            const optionMatch = line.match(/^([A-E])[\s.)]+(.+)/);
            if (optionMatch) {
                currentOption = optionMatch[1];
                currentQuestion.options[currentOption] = optionMatch[2];
            } else {
                // Conteúdo da questão ou da alternativa
                if (currentOption && currentQuestion.options[currentOption]) {
                    currentQuestion.options[currentOption] += ' ' + line;
                } else if (currentQuestion.text) {
                    currentQuestion.text += ' ' + line;
                }
            }
        }
    }

    // Salvar última
    if (currentQuestion && currentQuestion.text && currentQuestion.options.A) {
        questions.push({
            institution, year, area,
            question_text: currentQuestion.text,
            option_a: currentQuestion.options.A || '',
            option_b: currentQuestion.options.B || '',
            option_c: currentQuestion.options.C || '',
            option_d: currentQuestion.options.D || '',
            option_e: currentQuestion.options.E || null,
            correct_answer: 'A',
        });
    }

    return questions.filter(q => q.option_a && q.option_b && q.question_text.length > 20);
}

async function syncQuestions() {
    console.log('🏗️  Iniciando Sincronização de Questões (Monta Provas Context)...');

    // Import dinâmico do DB
    const { db, query } = await import('../lib/db');

    try {
        // 1. Pegar documentos que já foram processados (existem na tabela documents)
        const { rows: documents } = await query('SELECT * FROM documents WHERE processed = TRUE');
        console.log(`📂 Encontrados ${documents.length} documentos indexados.`);

        for (const doc of documents) {
            console.log(`\n📄 Verificando: ${doc.title}`);

            // 2. Checar se já tem questões extraídas para este doc
            const { rows: qCount } = await query('SELECT count(*) as total FROM questions WHERE document_id = $1', [doc.id]);
            if (parseInt(qCount[0].total) > 0) {
                console.log(`   ⏭️  Já possui ${qCount[0].total} questões. Pulando.`);
                continue;
            }

            // 3. Baixar PDF do Spaces
            console.log('   ⬇️  Baixando para extração...');
            const getCommand = new GetObjectCommand({
                Bucket: process.env.SPACES_BUCKET,
                Key: doc.pdf_url // Salvamos a "Key" no campo pdf_url
            });
            const fileData = await s3.send(getCommand);
            const pdfBuffer = await streamToBuffer(fileData.Body as Readable);

            // 4. Parsear
            console.log('   👀 Extraindo questões estruturadas...');
            const data = await pdfParse(pdfBuffer);
            const questions = await extractQuestionsFromText(data.text, doc.title);

            console.log(`   🧠 Identificadas ${questions.length} questões.`);

            // 5. Salvar no Banco
            let saved = 0;
            for (const q of questions) {
                // Inserção simples (CORRIGIDO: Removido campo 'institution')
                await query(`
                    INSERT INTO questions 
                    (document_id, stem, option_a, option_b, option_c, option_d, option_e, correct_option, area)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    doc.id,
                    q.question_text,
                    q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
                    'A', // Placeholder para gabarito, idealmente extrairia do arquivo de gabarito
                    q.area
                ]);
                saved++;
                process.stdout.write('.');
            }
            console.log(`\n   ✅ Salvas ${saved} questões na tabela.`);
        }

        console.log('\n🎉 Sincronização de Questões Finalizada!');

    } catch (error) {
        console.error('❌ Erro no Sync Questions:', error);
    } finally {
        process.exit(0);
    }
}

syncQuestions();
