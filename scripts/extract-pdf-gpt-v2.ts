// Script para extrair questões de PDFs usando OpenAI Assistants API
// Esta API suporta upload de PDFs nativamente
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY não configurada!');
    process.exit(1);
}

const pdfPath = process.argv[2];

if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error('❌ Uso: npx tsx extract-pdf-gpt-v2.ts <caminho-do-pdf>');
    process.exit(1);
}

// Função fetch nativa do Node 18+
async function apiRequest(endpoint: string, options: any) {
    const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2',
            ...options.headers
        }
    });
    return response.json();
}

async function extractWithAssistants() {
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

    if (lower.includes('2021')) year = 2021;
    else if (lower.includes('2022')) year = 2022;
    else if (lower.includes('2023')) year = 2023;
    else if (lower.includes('2024')) year = 2024;
    else if (lower.includes('2025')) year = 2025;
    else if (lower.includes('2026')) year = 2026;

    console.log(`🏥 ${institution} ${year}\n`);

    // 1. Upload do arquivo
    console.log('📤 Fazendo upload do PDF...');
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(pdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    formData.append('file', blob, filename);
    formData.append('purpose', 'assistants');

    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: formData
    });
    const uploadResult = await uploadResponse.json();

    if (uploadResult.error) {
        console.error('❌ Erro upload:', uploadResult.error.message);
        process.exit(1);
    }

    const fileId = uploadResult.id;
    console.log(`✅ Upload OK: ${fileId}\n`);

    // 2. Criar Assistant
    console.log('🤖 Criando assistente...');
    const assistant = await apiRequest('/assistants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Extrator de Questões',
            instructions: `Você extrai questões de provas de residência médica de PDFs.
Retorne APENAS um array JSON válido com as questões, sem markdown nem explicações.
Formato: [{"numero":1,"texto_questao":"...","alternativa_a":"...","alternativa_b":"...","alternativa_c":"...","alternativa_d":"...","alternativa_e":"...","gabarito":"A/B/C/D/E","area":"...","dificuldade":"facil/media/dificil"}]`,
            model: 'gpt-4o',
            tools: [{ type: 'file_search' }]
        })
    });

    if (assistant.error) {
        console.error('❌ Erro criar assistant:', assistant.error.message);
        process.exit(1);
    }
    console.log(`✅ Assistant: ${assistant.id}\n`);

    // 3. Criar Thread com arquivo
    console.log('💬 Criando thread...');
    const thread = await apiRequest('/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: [{
                role: 'user',
                content: 'Extraia TODAS as questões deste PDF de prova de residência médica. Retorne APENAS o array JSON.',
                attachments: [{
                    file_id: fileId,
                    tools: [{ type: 'file_search' }]
                }]
            }]
        })
    });

    if (thread.error) {
        console.error('❌ Erro criar thread:', thread.error.message);
        process.exit(1);
    }
    console.log(`✅ Thread: ${thread.id}\n`);

    // 4. Executar
    console.log('⏳ Processando (pode demorar alguns minutos)...');
    const run = await apiRequest(`/threads/${thread.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            assistant_id: assistant.id
        })
    });

    if (run.error) {
        console.error('❌ Erro executar:', run.error.message);
        process.exit(1);
    }

    // 5. Aguardar conclusão
    let status = run.status;
    let attempts = 0;
    while (status !== 'completed' && status !== 'failed' && attempts < 60) {
        await new Promise(r => setTimeout(r, 5000));
        const check = await apiRequest(`/threads/${thread.id}/runs/${run.id}`, { method: 'GET' });
        status = check.status;
        attempts++;
        process.stdout.write(`\r   Status: ${status} (${attempts * 5}s)`);
    }
    console.log();

    if (status !== 'completed') {
        console.error(`❌ Falha: ${status}`);
        process.exit(1);
    }

    // 6. Obter resultado
    console.log('\n📥 Obtendo resultado...');
    const messages = await apiRequest(`/threads/${thread.id}/messages`, { method: 'GET' });

    const assistantMessage = messages.data?.find((m: any) => m.role === 'assistant');
    if (!assistantMessage) {
        console.error('❌ Nenhuma resposta encontrada');
        process.exit(1);
    }

    const responseText = assistantMessage.content[0]?.text?.value || '';
    fs.writeFileSync('gpt-response-text.txt', responseText, 'utf-8');

    // Extrair JSON
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        console.error('❌ JSON não encontrado na resposta');
        console.log('Resposta:', responseText.slice(0, 500));
        process.exit(1);
    }

    let questions: any[];
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
            } else {
                throw e;
            }
        } else {
            throw e;
        }
    }

    console.log(`\n✅ ${questions.length} questões extraídas!`);

    // Gerar SQL
    const outputFile = `import-${institution.toLowerCase()}-${year}-gpt.sql`;
    let sql = `-- ${institution} ${year} (via GPT-4o Assistants)\n-- Total: ${questions.length} questões\n\n`;

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

    // Limpeza
    console.log('\n🧹 Limpando recursos...');
    await apiRequest(`/assistants/${assistant.id}`, { method: 'DELETE' });
    await apiRequest(`/files/${fileId}`, { method: 'DELETE' });

    console.log('\n🎉 Concluído!');
}

extractWithAssistants().catch(e => {
    console.error('\n💥 Erro:', e.message);
    process.exit(1);
});
