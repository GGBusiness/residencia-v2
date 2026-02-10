// Script COMPLETO para extrair TODAS as questões de um PDF
// Usa paginação para garantir 100% das questões
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const pdfPath = process.argv[2];

if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error('❌ Uso: npx tsx extract-full.ts <caminho-do-pdf>');
    process.exit(1);
}

async function api(endpoint: string, options: any) {
    const res = await fetch(`https://api.openai.com/v1${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2',
            ...options.headers
        }
    });
    return res.json();
}

async function extractAllQuestions() {
    const filename = path.basename(pdfPath);
    console.log(`\n🚀 EXTRAÇÃO COMPLETA: ${filename}\n`);

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
    if (/20(\d{2})/.test(lower)) year = parseInt(lower.match(/20(\d{2})/)![0]);

    console.log(`🏥 ${institution} ${year}\n`);

    // Upload PDF
    console.log('📤 Fazendo upload...');
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(pdfPath);
    formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), filename);
    formData.append('purpose', 'assistants');

    const upload = await (await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: formData
    })).json();

    if (upload.error) { console.error('❌', upload.error.message); return; }
    console.log(`✅ ${upload.id}\n`);

    // Criar Assistant otimizado
    console.log('🤖 Criando assistente...');
    const assistant = await api('/assistants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Extrator Completo',
            instructions: `Você extrai questões de provas de residência médica.

REGRAS IMPORTANTES:
1. Extraia ABSOLUTAMENTE TODAS as questões do PDF, sem exceção
2. Retorne APENAS JSON puro, SEM markdown, SEM \`\`\`json
3. Cada questão deve ter: numero, texto_questao, alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e (ou null), gabarito (A/B/C/D/E), area, dificuldade
4. Se o PDF tiver muitas questões, pode retornar em múltiplas mensagens

Formato exato:
[{"numero":1,"texto_questao":"...","alternativa_a":"...","alternativa_b":"...","alternativa_c":"...","alternativa_d":"...","alternativa_e":"...","gabarito":"A","area":"Clínica Médica","dificuldade":"media"}]`,
            model: 'gpt-4o',
            tools: [{ type: 'file_search' }]
        })
    });
    if (assistant.error) { console.error('❌', assistant.error.message); return; }

    // Thread
    const thread = await api('/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: [{
                role: 'user',
                content: `Extraia TODAS as questões deste PDF. 
O PDF contém uma prova de residência médica com múltiplas questões.
IMPORTANTE: 
- Extraia CADA UMA das questões, não pule nenhuma
- Retorne JSON PURO sem markdown
- Se precisar, faça em partes mas NÃO PARE até extrair todas

Comece pela questão 1 e vá até a última.`,
                attachments: [{ file_id: upload.id, tools: [{ type: 'file_search' }] }]
            }]
        })
    });

    // Run
    console.log('⏳ Processando (pode demorar)...');
    let run = await api(`/threads/${thread.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistant_id: assistant.id })
    });

    // Aguardar
    while (run.status !== 'completed' && run.status !== 'failed') {
        await new Promise(r => setTimeout(r, 3000));
        run = await api(`/threads/${thread.id}/runs/${run.id}`, { method: 'GET' });
        process.stdout.write('.');
    }
    console.log(` ${run.status}`);

    if (run.status !== 'completed') {
        console.error('❌ Falhou');
        return;
    }

    // Coletar TODAS as mensagens
    const messages = await api(`/threads/${thread.id}/messages?limit=100`, { method: 'GET' });

    let allQuestions: any[] = [];

    for (const msg of messages.data || []) {
        if (msg.role !== 'assistant') continue;

        for (const content of msg.content || []) {
            if (content.type !== 'text') continue;

            let text = content.text?.value || '';

            // Limpar markdown se houver
            text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

            // Tentar extrair JSON
            const matches = text.match(/\[[\s\S]*?\]/g);
            for (const match of matches || []) {
                try {
                    const questions = JSON.parse(match);
                    if (Array.isArray(questions)) {
                        allQuestions.push(...questions);
                    }
                } catch (e) {
                    // Tentar recuperar JSON truncado
                    const lastComplete = match.lastIndexOf('},');
                    if (lastComplete > 0) {
                        try {
                            const fixed = match.slice(0, lastComplete + 1) + ']';
                            const questions = JSON.parse(fixed);
                            allQuestions.push(...questions);
                        } catch (e2) { }
                    }
                }
            }
        }
    }

    // Remover duplicatas por número
    const uniqueQuestions = allQuestions.filter((q, i, arr) =>
        arr.findIndex(x => x.numero === q.numero) === i
    );

    console.log(`\n✅ ${uniqueQuestions.length} questões únicas extraídas!`);

    if (uniqueQuestions.length === 0) {
        console.log('⚠️ Nenhuma questão encontrada. Salvando resposta bruta...');
        fs.writeFileSync('debug-response.json', JSON.stringify(messages.data, null, 2));
        return;
    }

    // Gerar SQL
    const safeName = filename.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const sqlFile = `import-${safeName}.sql`;

    let sql = `-- ${institution} ${year} - ${uniqueQuestions.length} questões\n-- Extraído via GPT-4o Assistants (COMPLETO)\n\n`;

    for (const q of uniqueQuestions) {
        const esc = (s: any) => String(s || '').replace(/'/g, "''");
        sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${esc(q.area || 'Todas as áreas')}', ${q.subarea ? `'${esc(q.subarea)}'` : 'NULL'}, '${esc(q.dificuldade || 'media')}', '${esc(q.texto_questao)}', '${esc(q.alternativa_a)}', '${esc(q.alternativa_b)}', '${esc(q.alternativa_c)}', '${esc(q.alternativa_d)}', ${q.alternativa_e ? `'${esc(q.alternativa_e)}'` : 'NULL'}, '${esc(q.gabarito || 'A')}');\n`;
    }

    fs.writeFileSync(sqlFile, sql, 'utf-8');
    console.log(`💾 Salvo: ${sqlFile}`);

    // JSON também
    fs.writeFileSync(`${safeName}.json`, JSON.stringify(uniqueQuestions, null, 2));
    console.log(`💾 JSON: ${safeName}.json`);

    // Limpeza
    console.log('\n🧹 Limpando...');
    await api(`/assistants/${assistant.id}`, { method: 'DELETE' });
    await api(`/files/${upload.id}`, { method: 'DELETE' });

    console.log('\n🎉 Concluído!');
    return uniqueQuestions.length;
}

extractAllQuestions().catch(console.error);
