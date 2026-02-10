// Script de lote para extrair PDFs via OpenAI Assistants API
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PDF_LIST = [
    'c:\\Geral\\Alice\\Provas Antigas\\ENARE-2022-Objetiva.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\ENARE-2025.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\ENARE-2026-Objetiva-tipo-1.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\UNIFESP-2025-Objetiva-1.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\SUS-SP-2026-Objetiva.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\ISCMSP-SP-2026-Objetiva.pdf',
    'c:\\Geral\\Alice\\Provas Antigas\\Provas novas\\PSU-MG-2025-Objetiva-3.pdf',
];

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

async function extractPdf(pdfPath: string): Promise<any[] | null> {
    const filename = path.basename(pdfPath);
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📄 ${filename}`);

    if (!fs.existsSync(pdfPath)) {
        console.log('❌ Arquivo não encontrado');
        return null;
    }

    // Detectar instituição/ano
    const lower = filename.toLowerCase();
    let institution = 'ENARE', year = 2024;
    if (lower.includes('unicamp')) institution = 'UNICAMP';
    else if (lower.includes('usp')) institution = 'USP';
    else if (lower.includes('unifesp')) institution = 'UNIFESP';
    else if (lower.includes('iscmsp')) institution = 'ISCMSP';
    else if (lower.includes('sus')) institution = 'SUS-SP';
    else if (lower.includes('psu')) institution = 'PSU-MG';
    if (lower.includes('2021')) year = 2021;
    else if (lower.includes('2022')) year = 2022;
    else if (lower.includes('2023')) year = 2023;
    else if (lower.includes('2024')) year = 2024;
    else if (lower.includes('2025')) year = 2025;
    else if (lower.includes('2026')) year = 2026;

    try {
        // Upload
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(pdfPath);
        formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), filename);
        formData.append('purpose', 'assistants');

        const uploadRes = await fetch('https://api.openai.com/v1/files', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
            body: formData
        });
        const upload = await uploadRes.json();
        if (upload.error) throw new Error(upload.error.message);
        console.log(`📤 Upload: ${upload.id}`);

        // Assistant
        const assistant = await apiRequest('/assistants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Extrator',
                instructions: 'Extraia TODAS as questões do PDF em JSON: [{"numero":1,"texto_questao":"...","alternativa_a":"...","alternativa_b":"...","alternativa_c":"...","alternativa_d":"...","alternativa_e":"...","gabarito":"A","area":"...","dificuldade":"media"}]. Retorne APENAS o array JSON.',
                model: 'gpt-4o',
                tools: [{ type: 'file_search' }]
            })
        });
        if (assistant.error) throw new Error(assistant.error.message);

        // Thread
        const thread = await apiRequest('/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{
                    role: 'user',
                    content: 'Extraia TODAS as questões em JSON.',
                    attachments: [{ file_id: upload.id, tools: [{ type: 'file_search' }] }]
                }]
            })
        });
        if (thread.error) throw new Error(thread.error.message);

        // Run
        const run = await apiRequest(`/threads/${thread.id}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assistant_id: assistant.id })
        });

        // Wait
        let status = run.status;
        while (status !== 'completed' && status !== 'failed') {
            await new Promise(r => setTimeout(r, 5000));
            const check = await apiRequest(`/threads/${thread.id}/runs/${run.id}`, { method: 'GET' });
            status = check.status;
            process.stdout.write('.');
        }

        if (status !== 'completed') throw new Error('Run failed');

        // Get result
        const messages = await apiRequest(`/threads/${thread.id}/messages`, { method: 'GET' });
        const response = messages.data?.find((m: any) => m.role === 'assistant')?.content[0]?.text?.value || '';

        // Extract JSON
        const match = response.match(/\[[\s\S]*\]/);
        let questions: any[] = [];
        if (match) {
            try { questions = JSON.parse(match[0]); } catch (e) {
                const last = response.lastIndexOf('},');
                if (last > 0) questions = JSON.parse(response.slice(0, last + 1) + ']');
            }
        }

        console.log(` ✅ ${questions.length} questões`);

        // Save SQL
        if (questions.length > 0) {
            let sql = `-- ${institution} ${year}\n`;
            questions.forEach((q: any) => {
                const esc = (s: string) => (s || '').replace(/'/g, "''");
                sql += `INSERT INTO questions (institution, year, area, subarea, difficulty, question_text, option_a, option_b, option_c, option_d, option_e, correct_answer) VALUES ('${institution}', ${year}, '${esc(q.area || 'Todas as áreas')}', ${q.subarea ? `'${esc(q.subarea)}'` : 'NULL'}, '${q.dificuldade || 'media'}', '${esc(q.texto_questao)}', '${esc(q.alternativa_a)}', '${esc(q.alternativa_b)}', '${esc(q.alternativa_c)}', '${esc(q.alternativa_d)}', ${q.alternativa_e ? `'${esc(q.alternativa_e)}'` : 'NULL'}, '${q.gabarito || 'A'}');\n`;
            });
            fs.writeFileSync(`import-${institution.toLowerCase()}-${year}-gpt.sql`, sql);
        }

        // Cleanup
        await apiRequest(`/assistants/${assistant.id}`, { method: 'DELETE' });
        await apiRequest(`/files/${upload.id}`, { method: 'DELETE' });

        return questions;
    } catch (e: any) {
        console.log(` ❌ ${e.message}`);
        return null;
    }
}

async function main() {
    console.log('🚀 PROCESSAMENTO EM LOTE VIA GPT-4o');
    console.log(`📋 ${PDF_LIST.length} PDFs`);

    let total = 0;
    for (const pdf of PDF_LIST) {
        const questions = await extractPdf(pdf);
        if (questions) total += questions.length;
        await new Promise(r => setTimeout(r, 2000)); // Rate limit
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 Total: ${total} questões`);
}

main().catch(console.error);
