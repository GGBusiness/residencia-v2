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

const pdfPath = process.argv[2];

if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error('❌ Uso: npx tsx extract-pdf-v2.ts <caminho-do-pdf>');
    process.exit(1);
}

async function extractWithClaudeDocument() {
    const filename = path.basename(pdfPath);
    console.log(`\n🚀 Processando: ${filename}\n`);

    // Detectar instituição e ano
    const lower = filename.toLowerCase();
    let institution = 'ENARE';
    let year = 2024;

    if (lower.includes('unicamp')) institution = 'UNICAMP';
    if (lower.includes('usp')) institution = 'USP';
    if (lower.includes('unifesp')) institution = 'UNIFESP';
    if (lower.includes('iscmsp')) institution = 'ISCMSP';
    if (lower.includes('sus-sp')) institution = 'SUS-SP';
    if (lower.includes('psu')) institution = 'PSU-MG';
    if (lower.includes('unesp')) institution = 'UNESP';
    if (lower.includes('ufes')) institution = 'UFES';
    if (lower.includes('ufrj')) institution = 'UFRJ';

    if (lower.includes('2021')) year = 2021;
    if (lower.includes('2022')) year = 2022;
    if (lower.includes('2023')) year = 2023;
    if (lower.includes('2024')) year = 2024;
    if (lower.includes('2025')) year = 2025;
    if (lower.includes('2026')) year = 2026;

    console.log(`📋 ${institution} ${year}\n`);

    // Converter PDF para base64
    console.log('📄 Convertendo PDF para base64...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');
    const pdfSizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);
    console.log(`✅ ${pdfSizeMB} MB convertidos\n`);

    // Preparar payload
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
Analise o PDF acima e extraia TODAS as questões de múltipla escolha.

Para cada questão, retorne no formato JSON:
{
    "numero": 1,
    "texto_questao": "enunciado completo da questão",
    "alternativa_a": "texto completo da alternativa A",
    "alternativa_b": "texto completo da alternativa B",
    "alternativa_c": "texto completo da alternativa C",
    "alternativa_d": "texto completo da alternativa D",
    "alternativa_e": "texto completo da alternativa E ou null se não houver",
    "gabarito": "A" | "B" | "C" | "D" | "E",
    "area": "Cirurgia" | "Clínica Médica" | "GO" | "Pediatria" | "Medicina Preventiva" | "Todas as áreas",
    "subarea": "subárea específica ou null",
    "dificuldade": "facil" | "media" | "dificil"
}

IMPORTANTE:
- O campo "gabarito" é OBRIGATÓRIO - indica a letra da alternativa correta
- Retorne APENAS um array JSON válido, começando com [ e terminando com ]
- Não inclua markdown como \`\`\`json, apenas o array JSON puro
- Não invente ou omita informações
- Se não conseguir identificar o gabarito no PDF, coloque null
- Se não conseguir classificar área, use "Todas as áreas"

Retorne o JSON:`
                }
            ]
        }]
    });

    console.log('🤖 Enviando para Claude API...');
    console.log(`📦 Tamanho do payload: ${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(2)} MB\n`);

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

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                // Salvar resposta completa em arquivo de log
                const logFile = `api-response-${Date.now()}.json`;
                fs.writeFileSync(logFile, data, 'utf-8');
                console.log(`📝 Resposta salva em: ${logFile}`);

                if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                    console.error(`❌ Erro na API: ${res.statusCode}`);
                    console.error(data.slice(0, 1000));
                    reject(new Error(`API Error: ${res.statusCode}`));
                    return;
                }

                try {
                    const result = JSON.parse(data);
                    console.log('✅ Resposta recebida!');
                    console.log('📊 Tokens usados:', result.usage?.input_tokens, 'input,', result.usage?.output_tokens, 'output');

                    const responseText = result.content[0].text;

                    // Salvar texto de resposta
                    fs.writeFileSync('claude-response-text.txt', responseText, 'utf-8');
                    console.log('📝 Texto da resposta salvo em: claude-response-text.txt');

                    // Tentar extrair JSON
                    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

                    if (!jsonMatch) {
                        console.log('❌ Claude não retornou JSON válido');
                        console.log('Primeiros 500 chars:', responseText.slice(0, 500));
                        reject(new Error('Invalid JSON'));
                        return;
                    }

                    const questions = JSON.parse(jsonMatch[0]);
                    console.log(`\n✅ ${questions.length} questões extraídas!`);

                    // Mostrar amostra
                    if (questions.length > 0) {
                        console.log('\n📋 Primeira questão:');
                        console.log('  Número:', questions[0].numero);
                        console.log('  Texto:', questions[0].texto_questao?.slice(0, 100) + '...');
                        console.log('  Gabarito:', questions[0].gabarito || 'NÃO ENCONTRADO');
                    }

                    // Gerar SQL
                    const outputFilename = `import-${institution.toLowerCase()}-${year}.sql`;
                    let sql = `-- Questões ${institution} ${year}\n-- Gerado em: ${new Date().toISOString()}\n-- Total: ${questions.length} questões\n\n`;

                    questions.forEach((q: any, index: number) => {
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

                        sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${area}', ${subarea}, '${diff}', '${text}', '${optA}', '${optB}', '${optC}', '${optD}', ${optE}, '${correctAnswer}');\n\n`;
                    });

                    fs.writeFileSync(outputFilename, sql, 'utf-8');
                    console.log(`\n✅ Arquivo SQL gerado: ${outputFilename}`);
                    console.log(`📊 Tamanho: ${(Buffer.byteLength(sql) / 1024).toFixed(1)} KB`);
                    resolve(true);

                } catch (e: any) {
                    console.error('❌ Erro ao processar resposta:', e.message);
                    reject(e);
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ Erro na requisição:', e);
            reject(e);
        });

        req.write(payload);
        req.end();
    });
}

extractWithClaudeDocument()
    .then(() => console.log('\n🎉 Processo concluído com sucesso!'))
    .catch((e) => console.error('\n💥 Falha:', e.message));
