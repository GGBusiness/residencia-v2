const fs = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require('dotenv');

// Carregar .env.local manualmente pois dotenv pode não achar
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    dotenv.config();
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY não configurada!');
    process.exit(1);
}

const pdfPath = process.argv[2];

if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error('❌ Uso: node scripts/extract-pdf-simple.js <caminho-do-pdf>');
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
        model: 'claude-3-sonnet-20240229',
        max_tokens: 4096,
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
                    text: `Você é um especialista em extrair questões de provas médicas.
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
    "area": "Cirurgia" | "Clínica Médica" | "GO" | "Pediatria" | "Medicina Preventiva" | "Todas as áreas",
    "subarea": "subárea específica ou null",
    "dificuldade": "facil" | "media" | "dificil"
}

IMPORTANTE:
- Retorne APENAS um array JSON válido
- Não invente ou omita informações
- Se não conseguir classificar área, use "Todas as áreas"

Retorne o JSON:`
                }
            ]
        }]
    });

    console.log('🤖 Enviando para Claude API (via HTTPS)...');

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

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                console.error(`❌ Erro na API: ${res.statusCode}`);
                console.error(data);
                process.exit(1);
            }

            try {
                const result = JSON.parse(data);
                console.log('✅ Resposta recebida!\n');

                const responseText = result.content[0].text;
                const jsonMatch = responseText.match(/\[[\s\S]*\]/);

                if (!jsonMatch) {
                    console.log('❌ Claude não retornou JSON válido');
                    console.log('Resposta parcial:', responseText.slice(0, 500));
                    process.exit(1);
                }

                const questions = JSON.parse(jsonMatch[0]);
                console.log(`✅ ${questions.length} questões extraídas!\n`);

                // Gerar SQL
                const outputFilename = `import-${institution.toLowerCase()}-${year}.sql`;
                let sql = `-- Questões ${institution} ${year}\n\n`;

                questions.forEach((q, index) => {
                    const text = (q.texto_questao || '').replace(/'/g, "''");
                    const optA = (q.alternativa_a || '').replace(/'/g, "''");
                    const optB = (q.alternativa_b || '').replace(/'/g, "''");
                    const optC = (q.alternativa_c || '').replace(/'/g, "''");
                    const optD = (q.alternativa_d || '').replace(/'/g, "''");
                    const optE = q.alternativa_e ? `'${q.alternativa_e.replace(/'/g, "''")}'` : 'NULL';
                    const area = (q.area || 'Todas as áreas').replace(/'/g, "''");
                    const subarea = q.subarea ? `'${q.subarea.replace(/'/g, "''")}'` : 'NULL';
                    const diff = q.dificuldade || 'media';

                    sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${area}', ${subarea}, '${diff}', '${text}', '${optA}', '${optB}', '${optC}', '${optD}', ${optE}, 'A');\n\n`;
                });

                fs.writeFileSync(outputFilename, sql, 'utf-8');
                console.log(`✅ Arquivo gerado: ${outputFilename}`);

            } catch (e) {
                console.error('Erro ao processar JSON:', e);
                process.exit(1);
            }
        });
    });

    req.on('error', (e) => {
        console.error('❌ Erro na requisição:', e);
        process.exit(1);
    });

    req.write(payload);
    req.end();
}

extractWithClaudeDocument();
