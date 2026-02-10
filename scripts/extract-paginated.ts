// Script com PAGINAÇÃO para extrair 100% das questões
// Pede questões em chunks de 30 para garantir completude
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const pdfPath = process.argv[2];

if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error('❌ Uso: npx tsx extract-paginated.ts <caminho-do-pdf>');
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

async function runAndWait(threadId: string, assistantId: string, userMessage: string, fileId?: string) {
    // Adicionar mensagem
    const msgBody: any = { role: 'user', content: userMessage };
    if (fileId) {
        msgBody.attachments = [{ file_id: fileId, tools: [{ type: 'file_search' }] }];
    }

    await api(`/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgBody)
    });

    // Executar
    let run = await api(`/threads/${threadId}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistant_id: assistantId })
    });

    while (run.status !== 'completed' && run.status !== 'failed') {
        await new Promise(r => setTimeout(r, 2000));
        run = await api(`/threads/${threadId}/runs/${run.id}`, { method: 'GET' });
        process.stdout.write('.');
    }

    if (run.status !== 'completed') return null;

    // Pegar última resposta
    const msgs = await api(`/threads/${threadId}/messages?limit=5`, { method: 'GET' });
    const lastAssistant = msgs.data?.find((m: any) => m.role === 'assistant');
    return lastAssistant?.content[0]?.text?.value || '';
}

function parseQuestions(text: string): any[] {
    // Limpar markdown
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    const questions: any[] = [];
    const matches = text.match(/\[[\s\S]*?\]/g);

    for (const match of matches || []) {
        try {
            const parsed = JSON.parse(match);
            if (Array.isArray(parsed)) questions.push(...parsed);
        } catch (e) {
            // Tentar recuperar truncado
            const last = match.lastIndexOf('},');
            if (last > 0) {
                try {
                    questions.push(...JSON.parse(match.slice(0, last + 1) + ']'));
                } catch (e2) { }
            }
        }
    }

    return questions;
}

async function main() {
    const filename = path.basename(pdfPath);
    console.log(`\n🚀 EXTRAÇÃO PAGINADA: ${filename}\n`);

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
    if (/20(\d{2})/.test(lower)) year = parseInt(lower.match(/20(\d{2})/)![0]);

    console.log(`🏥 ${institution} ${year}\n`);

    // Upload
    console.log('📤 Upload...');
    const formData = new FormData();
    formData.append('file', new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' }), filename);
    formData.append('purpose', 'assistants');

    const upload = await (await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: formData
    })).json();
    console.log(`✅ ${upload.id}\n`);

    // Assistant
    const assistant = await api('/assistants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Extrator Paginado',
            instructions: `Você extrai questões de provas de residência médica.
REGRAS:
1. Retorne APENAS JSON puro, SEM markdown
2. Formato: [{"numero":N,"texto_questao":"...","alternativa_a":"...","alternativa_b":"...","alternativa_c":"...","alternativa_d":"...","alternativa_e":"...","gabarito":"X","area":"...","dificuldade":"..."}]
3. Quando pedirem um intervalo (ex: 1-30), extraia SOMENTE essas questões`,
            model: 'gpt-4o',
            tools: [{ type: 'file_search' }]
        })
    });

    // Thread
    const thread = await api('/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] })
    });

    let allQuestions: any[] = [];
    const CHUNK_SIZE = 25;
    const MAX_QUESTIONS = 150; // Máximo esperado por prova

    // Primeira chamada para descobrir quantas questões tem
    console.log('📋 Verificando total de questões...');
    const countResponse = await runAndWait(
        thread.id,
        assistant.id,
        'Quantas questões de múltipla escolha existem neste PDF? Responda apenas com o número.',
        upload.id
    );
    console.log(` ${countResponse?.trim()}`);

    const totalMatch = (countResponse || '').match(/(\d+)/);
    const estimatedTotal = totalMatch ? parseInt(totalMatch[1]) : 100;
    console.log(`📊 Estimado: ${estimatedTotal} questões\n`);

    // Extrair em chunks
    for (let start = 1; start <= Math.min(estimatedTotal, MAX_QUESTIONS); start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, estimatedTotal);
        console.log(`📄 Extraindo questões ${start} a ${end}...`);

        const prompt = `Extraia as questões de ${start} a ${end} do PDF.
Retorne APENAS o array JSON, sem explicações nem markdown.
Se alguma questão não existir, pule para a próxima.`;

        const response = await runAndWait(thread.id, assistant.id, prompt);
        const questions = parseQuestions(response || '');

        console.log(` ✅ ${questions.length} questões`);
        allQuestions.push(...questions);

        // Se não retornou nada, provavelmente acabou
        if (questions.length === 0) {
            console.log('⚠️ Nenhuma questão retornada, finalizando...');
            break;
        }
    }

    // Remover duplicatas
    const unique = allQuestions.filter((q, i, arr) =>
        arr.findIndex(x => x.numero === q.numero || x.texto_questao === q.texto_questao) === i
    );

    console.log(`\n🎯 TOTAL: ${unique.length} questões únicas\n`);

    if (unique.length > 0) {
        // Gerar SQL
        const sqlFile = `import-${institution.toLowerCase()}-${year}-full.sql`;
        let sql = `-- ${institution} ${year} - ${unique.length} questões (COMPLETO)\n\n`;

        for (const q of unique) {
            const esc = (s: any) => String(s || '').replace(/'/g, "''");
            sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${esc(q.area || 'Todas as áreas')}', ${q.subarea ? `'${esc(q.subarea)}'` : 'NULL'}, '${esc(q.dificuldade || 'media')}', '${esc(q.texto_questao)}', '${esc(q.alternativa_a)}', '${esc(q.alternativa_b)}', '${esc(q.alternativa_c)}', '${esc(q.alternativa_d)}', ${q.alternativa_e ? `'${esc(q.alternativa_e)}'` : 'NULL'}, '${esc(q.gabarito || 'A')}');\n`;
        }

        fs.writeFileSync(sqlFile, sql);
        fs.writeFileSync(`${institution.toLowerCase()}-${year}-full.json`, JSON.stringify(unique, null, 2));
        console.log(`💾 Salvos: ${sqlFile}`);
    }

    // Cleanup
    await api(`/assistants/${assistant.id}`, { method: 'DELETE' });
    await api(`/files/${upload.id}`, { method: 'DELETE' });

    console.log('\n🎉 Concluído!');
}

main().catch(console.error);
