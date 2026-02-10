// Script de processamento em lote de PDFs via Claude API
import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY não configurada!');
    process.exit(1);
}

// Lista de PDFs prioritários para processar (provas principais)
const PDF_LIST = [
    // ENARE
    'c:\\Geral\\Alice\\Provas Antigas\\ENARE-2021-Objetiva.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\ENARE-2022-Objetiva.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\ENARE-2023-Objetiva.pdf',
    // 2024 já foi processado
    'c:\\Geral\\Alice\\Provas Antigas\\ENARE-2025.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\ENARE-2026-Objetiva-tipo-1.pdf',

    // USP
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\prova-residencia-medica-usp-sp-r1-2026.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\prova-residencia-medica-usp-sp-cirurgia-geral-2026.pdf',

    // UNICAMP
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\prova-residencia-medica-unicamp-manha-tarde-r1-2026.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\prova-residencia-medica-unicamp-r-cir-2026.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\prova-residencia-medica-unicamp-r-ped-2026.pdf',

    // UNIFESP
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\UNIFESP-2025-Objetiva-1.pdf',

    // UNESP
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\UNESP-SP-2026-Objetiva-R1.pdf',

    // SUS-SP
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\SUS-SP-2026-Objetiva.pdf',

    // ISCMSP (Santa Casa)
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\ISCMSP-SP-2026-Objetiva.pdf',

    // PSU-MG
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\PSU-MG-2025-Objetiva-3.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\PSU-MG-2022-Objetiva.pdf',

    // UFES e UFRJ
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\UFES-ES-2025-Objetiva.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\UFRJ-2025-Objetiva-1.pdf',
];

// Resultados
const results: { pdf: string; success: boolean; questions: number; error?: string }[] = [];
let totalQuestions = 0;
let allSql = '-- Consolidado de todas as questões extraídas\n-- Gerado em: ' + new Date().toISOString() + '\n\n';

async function extractPdf(pdfPath: string): Promise<{ questions: any[]; sql: string } | null> {
    const filename = path.basename(pdfPath);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Processando: ${filename}`);
    console.log(`${'='.repeat(60)}`);

    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ Arquivo não encontrado: ${pdfPath}`);
        return null;
    }

    // Detectar instituição e ano
    const lower = filename.toLowerCase();
    let institution = 'ENARE';
    let year = 2024;

    if (lower.includes('unicamp')) institution = 'UNICAMP';
    else if (lower.includes('usp')) institution = 'USP';
    else if (lower.includes('unifesp')) institution = 'UNIFESP';
    else if (lower.includes('iscmsp') || lower.includes('santa casa')) institution = 'ISCMSP';
    else if (lower.includes('sus-sp')) institution = 'SUS-SP';
    else if (lower.includes('psu') || lower.includes('fhemig')) institution = 'PSU-MG';
    else if (lower.includes('unesp')) institution = 'UNESP';
    else if (lower.includes('ufes')) institution = 'UFES';
    else if (lower.includes('ufrj')) institution = 'UFRJ';

    if (lower.includes('2021')) year = 2021;
    else if (lower.includes('2022')) year = 2022;
    else if (lower.includes('2023')) year = 2023;
    else if (lower.includes('2024')) year = 2024;
    else if (lower.includes('2025')) year = 2025;
    else if (lower.includes('2026')) year = 2026;

    console.log(`🏥 Instituição: ${institution} | Ano: ${year}`);

    // Converter para base64
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');
    const sizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`📦 Tamanho: ${sizeMB} MB`);

    // Payload para API
    const payload = JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [{
            role: 'user',
            content: [
                {
                    type: 'document',
                    source: {
                        type: 'base64',
                        media_type: 'application/pdf',
                        data: pdfBase64
                    }
                },
                {
                    type: 'text',
                    text: `Você é um especialista em extrair questões de provas médicas de residência.
Analise o PDF e extraia TODAS as questões de múltipla escolha.

Para cada questão, retorne no formato JSON:
{
    "numero": 1,
    "texto_questao": "enunciado completo",
    "alternativa_a": "texto A",
    "alternativa_b": "texto B",
    "alternativa_c": "texto C",
    "alternativa_d": "texto D",
    "alternativa_e": "texto E ou null",
    "gabarito": "A" | "B" | "C" | "D" | "E" | null,
    "area": "Cirurgia" | "Clínica Médica" | "GO" | "Pediatria" | "Medicina Preventiva" | "Todas as áreas",
    "subarea": "subárea ou null",
    "dificuldade": "facil" | "media" | "dificil"
}

IMPORTANTE:
- O campo "gabarito" indica a letra da alternativa correta (se disponível no PDF)
- Retorne APENAS um array JSON válido, começando com [ e terminando com ]
- Não inclua markdown como \`\`\`json

Retorne o JSON:`
                }
            ]
        }]
    });

    console.log('🤖 Enviando para Claude API...');

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode !== 200) {
                    console.error(`❌ Erro API: ${res.statusCode}`);
                    try {
                        const errData = JSON.parse(data);
                        console.error('Detalhes:', errData.error?.message || data.slice(0, 200));

                        // Se for erro de créditos/rate limit, sinalizar para parar
                        if (res.statusCode === 429 || res.statusCode === 402 ||
                            (errData.error?.type && errData.error.type.includes('rate'))) {
                            console.log('\n⚠️ LIMITE DE CRÉDITOS/RATE LIMIT ATINGIDO!');
                            resolve(null);
                            return;
                        }
                    } catch (e) { }
                    resolve(null);
                    return;
                }

                try {
                    const result = JSON.parse(data);
                    const responseText = result.content[0].text;
                    console.log(`📊 Tokens: ${result.usage?.input_tokens} input, ${result.usage?.output_tokens} output`);

                    // Tentar extrair JSON (pode estar truncado)
                    let jsonMatch = responseText.match(/\[[\s\S]*\]/);
                    let questions: any[] = [];

                    if (jsonMatch) {
                        try {
                            questions = JSON.parse(jsonMatch[0]);
                        } catch (e) {
                            // JSON truncado - tentar recuperar
                            const lastComplete = responseText.lastIndexOf('},');
                            if (lastComplete > 0) {
                                const fixed = responseText.slice(0, lastComplete + 1) + '\n]';
                                const fixedMatch = fixed.match(/\[[\s\S]*\]/);
                                if (fixedMatch) {
                                    questions = JSON.parse(fixedMatch[0]);
                                    console.log('⚠️ JSON truncado - recuperado parcialmente');
                                }
                            }
                        }
                    }

                    if (questions.length === 0) {
                        console.log('❌ Não foi possível extrair questões');
                        resolve(null);
                        return;
                    }

                    console.log(`✅ ${questions.length} questões extraídas!`);

                    // Gerar SQL
                    let sql = `-- ${institution} ${year} (${questions.length} questões)\n`;
                    questions.forEach((q: any) => {
                        const text = (q.texto_questao || '').replace(/'/g, "''");
                        const optA = (q.alternativa_a || '').replace(/'/g, "''");
                        const optB = (q.alternativa_b || '').replace(/'/g, "''");
                        const optC = (q.alternativa_c || '').replace(/'/g, "''");
                        const optD = (q.alternativa_d || '').replace(/'/g, "''");
                        const optE = q.alternativa_e ? `'${q.alternativa_e.replace(/'/g, "''")}'` : 'NULL';
                        const area = (q.area || 'Todas as áreas').replace(/'/g, "''");
                        const subarea = q.subarea ? `'${q.subarea.replace(/'/g, "''")}'` : 'NULL';
                        const diff = q.dificuldade || 'media';
                        const correctAnswer = q.gabarito || 'A';

                        sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${area}', ${subarea}, '${diff}', '${text}', '${optA}', '${optB}', '${optC}', '${optD}', ${optE}, '${correctAnswer}');\n`;
                    });

                    resolve({ questions, sql });

                } catch (e: any) {
                    console.error('❌ Erro processar resposta:', e.message);
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ Erro requisição:', e.message);
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
}

async function main() {
    console.log('🚀 PROCESSAMENTO EM LOTE DE PDFs');
    console.log(`📋 Total de PDFs na fila: ${PDF_LIST.length}`);
    console.log(''.padStart(60, '='));

    for (let i = 0; i < PDF_LIST.length; i++) {
        const pdfPath = PDF_LIST[i];
        console.log(`\n[${i + 1}/${PDF_LIST.length}] Processando...`);

        const result = await extractPdf(pdfPath);

        if (result) {
            results.push({
                pdf: path.basename(pdfPath),
                success: true,
                questions: result.questions.length
            });
            totalQuestions += result.questions.length;
            allSql += result.sql + '\n';

            // Salvar SQL individual
            const sqlFile = `import-${path.basename(pdfPath, '.pdf').toLowerCase().replace(/ /g, '-')}.sql`;
            fs.writeFileSync(sqlFile, result.sql, 'utf-8');
            console.log(`💾 Salvo: ${sqlFile}`);
        } else {
            results.push({
                pdf: path.basename(pdfPath),
                success: false,
                questions: 0,
                error: 'Falha na extração'
            });

            // Verificar se é erro de créditos
            console.log('\n⚠️ Falha na extração - verificando se devemos continuar...');
        }

        // Pausa entre requisições para evitar rate limit
        if (i < PDF_LIST.length - 1) {
            console.log('⏳ Aguardando 2s antes do próximo...');
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DO PROCESSAMENTO');
    console.log('='.repeat(60));

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Sucesso: ${successCount}/${results.length} PDFs`);
    console.log(`📝 Total de questões: ${totalQuestions}`);

    console.log('\n📋 Detalhes:');
    results.forEach(r => {
        const status = r.success ? '✅' : '❌';
        console.log(`  ${status} ${r.pdf}: ${r.questions} questões`);
    });

    // Salvar SQL consolidado
    if (totalQuestions > 0) {
        allSql = `-- Total consolidado: ${totalQuestions} questões\n` + allSql;
        fs.writeFileSync('import-all-extracted.sql', allSql, 'utf-8');
        console.log(`\n💾 SQL consolidado salvo: import-all-extracted.sql`);
        console.log(`📊 Tamanho: ${(Buffer.byteLength(allSql) / 1024).toFixed(1)} KB`);
    }

    // Salvar resultados
    fs.writeFileSync('extraction-results.json', JSON.stringify(results, null, 2), 'utf-8');
    console.log('📋 Resultados salvos: extraction-results.json');
}

main().catch(console.error);
