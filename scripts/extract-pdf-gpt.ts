// Script para extrair questões de PDFs usando OpenAI GPT-4o
import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY não configurada!');
    console.log('\n📝 Adicione no arquivo .env.local:');
    console.log('OPENAI_API_KEY=sk-...');
    process.exit(1);
}

const pdfPath = process.argv[2];

if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error('❌ Uso: npx tsx extract-pdf-gpt.ts <caminho-do-pdf>');
    process.exit(1);
}

async function extractWithGPT() {
    const filename = path.basename(pdfPath);
    console.log(`\n🚀 Processando: ${filename}\n`);

    // Detectar instituição e ano
    const lower = filename.toLowerCase();
    let institution = 'ENARE';
    let year = 2024;

    if (lower.includes('unicamp')) institution = 'UNICAMP';
    else if (lower.includes('usp')) institution = 'USP';
    else if (lower.includes('unifesp')) institution = 'UNIFESP';
    else if (lower.includes('iscmsp')) institution = 'ISCMSP';
    else if (lower.includes('sus-sp')) institution = 'SUS-SP';
    else if (lower.includes('psu')) institution = 'PSU-MG';
    else if (lower.includes('unesp')) institution = 'UNESP';
    else if (lower.includes('ufes')) institution = 'UFES';
    else if (lower.includes('ufrj')) institution = 'UFRJ';

    if (lower.includes('2021')) year = 2021;
    else if (lower.includes('2022')) year = 2022;
    else if (lower.includes('2023')) year = 2023;
    else if (lower.includes('2024')) year = 2024;
    else if (lower.includes('2025')) year = 2025;
    else if (lower.includes('2026')) year = 2026;

    console.log(`🏥 ${institution} ${year}\n`);

    // Converter PDF para base64
    console.log('📄 Convertendo PDF para base64...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');
    console.log(`✅ ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB\n`);

    // GPT-4o suporta PDFs via URL ou imagens, mas para base64 precisamos converter para imagens
    // Alternativa: usar GPT-4o com texto extraído do PDF

    // Para PDFs, vamos usar a API de Assistants com file upload
    // Ou podemos enviar como imagem se for pequeno

    const payload = JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 16000,
        messages: [{
            role: 'user',
            content: [
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:application/pdf;base64,${pdfBase64}`,
                        detail: 'high'
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
- Retorne APENAS um array JSON válido, começando com [ e terminando com ]
- Não inclua markdown como \`\`\`json

Retorne o JSON:`
                }
            ]
        }]
    });

    console.log('🤖 Enviando para OpenAI API (GPT-4o)...');

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.openai.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                // Salvar resposta
                fs.writeFileSync('gpt-response.json', data, 'utf-8');

                if (res.statusCode !== 200) {
                    console.error(`❌ Erro API: ${res.statusCode}`);
                    try {
                        const err = JSON.parse(data);
                        console.error(err.error?.message || data.slice(0, 300));
                    } catch (e) {
                        console.error(data.slice(0, 300));
                    }
                    reject(new Error(`API Error: ${res.statusCode}`));
                    return;
                }

                try {
                    const result = JSON.parse(data);
                    const responseText = result.choices[0].message.content;
                    console.log(`📊 Tokens: ${result.usage?.total_tokens}`);

                    // Salvar texto
                    fs.writeFileSync('gpt-response-text.txt', responseText, 'utf-8');

                    // Extrair JSON
                    let jsonMatch = responseText.match(/\[[\s\S]*\]/);
                    let questions: any[] = [];

                    if (jsonMatch) {
                        try {
                            questions = JSON.parse(jsonMatch[0]);
                        } catch (e) {
                            // Tentar recuperar JSON truncado
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
                        console.log('Resposta:', responseText.slice(0, 500));
                        reject(new Error('No questions'));
                        return;
                    }

                    console.log(`\n✅ ${questions.length} questões extraídas!`);

                    // Gerar SQL
                    const outputFile = `import-${institution.toLowerCase()}-${year}-gpt.sql`;
                    let sql = `-- ${institution} ${year} (via GPT-4o)\n-- Total: ${questions.length} questões\n\n`;

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

                    fs.writeFileSync(outputFile, sql, 'utf-8');
                    console.log(`💾 SQL salvo: ${outputFile}`);

                    // Salvar JSON
                    fs.writeFileSync(`${institution.toLowerCase()}-${year}-gpt.json`, JSON.stringify(questions, null, 2), 'utf-8');

                    resolve(questions);
                } catch (e: any) {
                    console.error('❌ Erro:', e.message);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ Erro requisição:', e);
            reject(e);
        });

        req.write(payload);
        req.end();
    });
}

extractWithGPT()
    .then(() => console.log('\n🎉 Extração concluída!'))
    .catch((e) => console.error('\n💥 Falha:', e.message));
