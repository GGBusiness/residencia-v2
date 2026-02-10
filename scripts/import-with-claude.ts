import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface Question {
    institution: string;
    year: number;
    area: string;
    subarea?: string;
    difficulty: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    option_e?: string | null;
    correct_answer: string;
    explanation?: string;
}

function detectInstitution(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('enare')) return 'ENARE';
    if (lower.includes('usp')) return 'USP';
    if (lower.includes('unicamp')) return 'UNICAMP';
    if (lower.includes('unifesp')) return 'UNIFESP';
    if (lower.includes('unesp')) return 'UNESP';
    if (lower.includes('sus-sp')) return 'SUS-SP';
    if (lower.includes('iscmsp')) return 'ISCMSP';
    if (lower.includes('psu')) return 'PSU-MG';
    return 'Outras';
}

function detectYear(filename: string): number {
    const match = filename.match(/20(\d{2})/);
    return match ? parseInt(`20${match[1]}`) : 2024;
}

function detectArea(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('cirurgia') || lower.includes('-cir')) return 'Cirurgia';
    if (lower.includes('clinica') || lower.includes('-cm')) return 'Clínica Médica';
    if (lower.includes('gineco') || lower.includes('-go')) return 'GO';
    if (lower.includes('pediatria') || lower.includes('-ped')) return 'Pediatria';
    if (lower.includes('preventiva')) return 'Medicina Preventiva';
    return 'Todas as áreas';
}

async function callClaudeAPI(pdfText: string): Promise<any> {
    if (!ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY não configurada no .env.local');
    }

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

IMPORTANTE: Extraia TODAS as questões do texto abaixo no formato JSON exato.

Para cada questão, retorne:
{
    "numero": 1,
    "texto_questao": "texto completo da questão",
    "alternativa_a": "texto da alternativa A",
    "alternativa_b": "texto da alternativa B",
    "alternativa_c": "texto da alternativa C",
    "alternativa_d": "texto da alternativa D",
    "alternativa_e": "texto da alternativa E (ou null se não houver)",
    "area": "Cirurgia" | "Clínica Médica" | "GO" | "Pediatria" | "Medicina Preventiva",
    "subarea": "subárea específica (ex: Trauma, Cardiologia, etc)",
    "dificuldade": "facil" | "media" | "dificil"
}

Retorne APENAS um array JSON válido, sem texto adicional.

TEXTO DA PROVA:
${pdfText.slice(0, 50000)}`
            }]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Erro na API do Claude: ${response.status} - ${error}`);
    }

    return await response.json();
}

async function extractWithClaude(pdfPath: string): Promise<Question[]> {
    const filename = path.basename(pdfPath);
    console.log(`\n📄 Processando: ${filename}`);

    try {
        // Ler PDF como texto bruto - DEBUG MODE
        const pdfParseModule: any = await import('pdf-parse');
        console.log('DEBUG - Módulo importado:', Object.keys(pdfParseModule));
        console.log('DEBUG - Tem .default?', typeof pdfParseModule.default);
        console.log('DEBUG - Tipo do módulo:', typeof pdfParseModule);

        let pdfParse;
        if (typeof pdfParseModule === 'function') {
            pdfParse = pdfParseModule;
        } else if (typeof pdfParseModule.default === 'function') {
            pdfParse = pdfParseModule.default;
        } else {
            // Tentar todas as propriedades até achar uma função
            for (const key of Object.keys(pdfParseModule)) {
                if (typeof pdfParseModule[key] === 'function') {
                    console.log(`DEBUG - Encontramos função em: ${key}`);
                    pdfParse = pdfParseModule[key];
                    break;
                }
            }
        }

        if (!pdfParse) {
            throw new Error('PDF parse function not found in module');
        }

        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        const pdfText = data.text;

        console.log(`  📝 Enviando ${pdfText.length} caracteres para Claude...`);

        // Chamar Claude API
        const apiResponse = await callClaudeAPI(pdfText);

        const responseText = apiResponse.content[0].text;

        // Extrair JSON da resposta
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.log(`  ❌ Claude não retornou JSON válido`);
            console.log(`  Resposta: ${responseText.slice(0, 200)}...`);
            return [];
        }

        const extractedQuestions = JSON.parse(jsonMatch[0]);

        const institution = detectInstitution(filename);
        const year = detectYear(filename);
        const defaultArea = detectArea(filename);

        // Converter para formato do banco
        const questions: Question[] = extractedQuestions.map((q: any) => ({
            institution,
            year,
            area: q.area || defaultArea,
            subarea: q.subarea || null,
            difficulty: q.dificuldade || 'media',
            question_text: q.texto_questao,
            option_a: q.alternativa_a,
            option_b: q.alternativa_b,
            option_c: q.alternativa_c,
            option_d: q.alternativa_d,
            option_e: q.alternativa_e || null,
            correct_answer: 'A', // Precisaria processar gabarito separadamente
            explanation: null,
        })).filter((q: Question) =>
            q.question_text?.length > 30 &&
            q.option_a && q.option_b && q.option_c && q.option_d
        );

        console.log(`  ✅ ${questions.length} questões extraídas`);
        return questions;

    } catch (error: any) {
        console.error(`  ❌ Erro: ${error.message}`);
        return [];
    }
}

async function importToSupabase(questions: Question[]) {
    if (questions.length === 0) return 0;

    console.log(`\n📊 Importando ${questions.length} questões para Supabase...`);

    const { data, error } = await supabase
        .from('questions')
        .insert(questions)
        .select();

    if (error) {
        console.error(`❌ Erro na importação:`, error.message);
        return 0;
    }

    console.log(`✅ ${data?.length || 0} questões importadas com sucesso!`);
    return data?.length || 0;
}

async function main() {
    console.log('🚀 IMPORTAÇÃO INTELIGENTE COM CLAUDE API\n');
    console.log('═══════════════════════════════════════\n');

    if (!ANTHROPIC_API_KEY) {
        console.error('❌ ERRO: ANTHROPIC_API_KEY não configurada!');
        console.log('\n📌 Configure no .env.local:');
        console.log('   ANTHROPIC_API_KEY=sk-ant-api03-...\n');
        console.log('🔗 Obtenha em: https://console.anthropic.com/\n');
        process.exit(1);
    }

    const rootDir = 'c:\\Geral\\Alice\\Provas Antigas\\Provas novas';

    // Buscar PDFs prioritários
    const pdfs = fs.readdirSync(rootDir)
        .filter(f => f.toLowerCase().endsWith('.pdf'))
        .filter(f => !f.toLowerCase().includes('gabarito'))
        .map(f => path.join(rootDir, f));

    // Filtrar provas oficiais
    const priorityPDFs = pdfs.filter(pdf => {
        const name = path.basename(pdf).toLowerCase();
        return (
            name.includes('enare') ||
            name.includes('usp') ||
            name.includes('unicamp') ||
            name.includes('unifesp') ||
            name.includes('unesp') ||
            name.includes('sus-sp')
        );
    });

    console.log(`📚 Total de PDFs encontrados: ${pdfs.length}`);
    console.log(`🎯 PDFs prioritários: ${priorityPDFs.length}\n`);

    let totalImported = 0;
    const processedPDFs: string[] = [];

    // Processar primeiros 3 PDFs como teste
    const testPDFs = priorityPDFs.slice(0, 3);

    console.log(`🧪 Processando ${testPDFs.length} PDFs de teste...\n`);

    for (const pdfPath of testPDFs) {
        const questions = await extractWithClaude(pdfPath);
        const imported = await importToSupabase(questions);

        totalImported += imported;
        if (imported > 0) {
            processedPDFs.push(path.basename(pdfPath));
        }

        // Delay para não sobrecarregar API
        console.log('  ⏳ Aguardando 3 segundos...\n');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n═══════════════════════════════════════');
    console.log('📈 RESULTADO FINAL\n');
    console.log(`✅ Total importado: ${totalImported} questões`);
    console.log(`📄 PDFs processados: ${processedPDFs.length} \n`);

    if (processedPDFs.length > 0) {
        console.log('PDFs importados:');
        processedPDFs.forEach(pdf => console.log(`  - ${pdf} `));
    }

    console.log('\n🎉 Importação concluída!');
    console.log('\n💡 Para processar TODOS os PDFs, remova o .slice(0, 3) na linha 234');
}

main().catch(console.error);
