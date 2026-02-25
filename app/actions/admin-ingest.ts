'use server';

import { query } from '@/lib/db';
import { GPT_MODEL } from '@/lib/model-config';

export async function ingestPDFAction(formData: FormData) {
    console.log('📄 Iniciando ingestão de PDF...');

    try {
        const file = formData.get('file') as File;
        if (!file) {
            throw new Error('Nenhum arquivo enviado.');
        }

        // 1. Converter File para Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Extrair Texto com pdf-parse
        const pdfParseModule: any = await import('pdf-parse');
        let pdfParse = pdfParseModule.default || pdfParseModule;
        if (typeof pdfParse !== 'function') {
            for (const key of Object.keys(pdfParseModule)) {
                if (typeof pdfParseModule[key] === 'function') {
                    pdfParse = pdfParseModule[key];
                    break;
                }
            }
        }
        if (typeof pdfParse !== 'function') {
            throw new Error('Falha ao carregar biblioteca PDF-Parse.');
        }

        const data = await pdfParse(buffer);
        const pdfText = data.text;

        console.log(`  ✅ Texto extraído: ${pdfText.length} caracteres`);

        // 3. Enviar para OpenAI (GPT-4o) para extração
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        if (!process.env.OPENAI_API_KEY) throw new Error('Chave da OpenAI não configurada.');

        const completion = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                {
                    role: "system",
                    content: "Você é um especialista em extrair questões de provas médicas. Retorne APENAS um JSON válido. Distribua o gabarito entre A, B, C, D e E."
                },
                {
                    role: "user",
                    content: `EXTRAIA AS QUESTÕES DESTE TEXTO.

Regras CRÍTICAS:
- ENUNCIADO COMPLETO: Extraia o stem completo, incluindo caso clínico. NUNCA corte no meio da frase.
  O stem deve começar com letra maiúscula e conter a pergunta completa.
- ALTERNATIVAS ÚNICAS: Cada alternativa DEVE ser substancialmente diferente das outras.
  NUNCA repita o mesmo texto em duas alternativas.
- DISTRIBUA o gabarito entre A, B, C, D e E de forma equilibrada.
- Inclua explicação médica detalhada.

Para cada questão, retorne JSON com:
{
    "stem": "Enunciado COMPLETO incluindo caso clínico...",
    "option_a": "...",
    "option_b": "... (diferente de A)",
    "option_c": "...",
    "option_d": "...",
    "option_e": "..." (ou null),
    "correct_option": "C" (distribua entre A-E, NÃO coloque sempre A),
    "area": "Clinica Medica" (detecte pelo contexto),
    "explanation": "Explicação médica detalhada"
}

Retorne { "questions": [...] } como JSON.

TEXTO:
${pdfText.slice(0, 50000)}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });

        const contentText = completion.choices[0].message.content;

        let extractedQuestions = [];
        try {
            const parsed = JSON.parse(contentText || '{}');
            if (Array.isArray(parsed)) extractedQuestions = parsed;
            else if (parsed.questions && Array.isArray(parsed.questions)) extractedQuestions = parsed.questions;
            else {
                const values = Object.values(parsed);
                const arrayFound = values.find(v => Array.isArray(v));
                if (arrayFound) extractedQuestions = arrayFound as any[];
            }
            if (extractedQuestions.length === 0) throw new Error('Nenhuma questão encontrada no JSON.');
        } catch (e) {
            console.error('JSON Parse Error:', contentText);
            throw new Error('Falha ao processar resposta da IA.');
        }

        console.log(`  ✅ ${extractedQuestions.length} questões identificadas pela IA`);

        // Log Usage
        const usage = completion.usage || { prompt_tokens: 0, completion_tokens: 0 };
        try {
            const { aiTracker } = await import('@/lib/ai-tracker');
            await aiTracker.logUsage({
                provider: 'openai',
                model: GPT_MODEL,
                tokensInput: usage.prompt_tokens || 0,
                tokensOutput: usage.completion_tokens || 0,
                context: `ingest_pdf: ${file.name}`,
                userId: undefined
            });
        } catch (e) {
            console.error('Tracker error', e);
        }

        // 4. Primeiro criar o documento no DigitalOcean
        const filename = file.name.toLowerCase();
        let institution = 'Outras';
        if (filename.includes('enare')) institution = 'ENARE';
        else if (filename.includes('usp')) institution = 'USP-SP';
        else if (filename.includes('unicamp')) institution = 'UNICAMP';

        const yearMatch = file.name.match(/20(\d{2})/);
        const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : new Date().getFullYear();

        const { rows: docRows } = await query(`
            INSERT INTO documents (title, type, institution, year, processed)
            VALUES ($1, 'PROVA', $2, $3, TRUE)
            RETURNING id
        `, [file.name, institution, year]);

        const docId = docRows[0].id;

        // 5. Salvar questões com VALIDAÇÃO DE QUALIDADE AUTOMÁTICA
        let savedCount = 0;
        let rejectedCount = 0;
        for (const q of extractedQuestions) {
            const stem = q.stem || q.question_text || '';

            // 1. Stem muito curto ou vazio
            if (!stem || stem.length < 30) {
                console.log(`⚠️ REJEITADA: Enunciado muito curto (${stem.length} chars)`);
                rejectedCount++;
                continue;
            }

            // 2. Stem cortado (começa com letra minúscula = fragmento)
            const firstChar = stem.trim()[0];
            if (firstChar && firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase()) {
                console.log(`⚠️ REJEITADA: Enunciado parece cortado`);
                rejectedCount++;
                continue;
            }

            // 3. Alternativas obrigatórias
            const optA = q.option_a || '';
            const optB = q.option_b || '';
            const optC = q.option_c || '';
            const optD = q.option_d || '';
            const optE = q.option_e || null;

            if (!optA || !optB || !optC || !optD) {
                console.log(`⚠️ REJEITADA: Alternativas A-D faltando`);
                rejectedCount++;
                continue;
            }

            // 4. Detectar alternativas duplicadas/similares
            const allOpts = [optA, optB, optC, optD, optE].filter(Boolean).map((o: string) => o.toLowerCase().trim().replace(/[.,;:!?]+$/, ''));
            let hasDuplicate = false;
            for (let i = 0; i < allOpts.length; i++) {
                for (let j = i + 1; j < allOpts.length; j++) {
                    const shorter = allOpts[i].length < allOpts[j].length ? allOpts[i] : allOpts[j];
                    const longer = allOpts[i].length >= allOpts[j].length ? allOpts[i] : allOpts[j];
                    if (shorter.length > 10 && longer.includes(shorter.substring(0, Math.floor(shorter.length * 0.8)))) {
                        hasDuplicate = true;
                        break;
                    }
                    if (allOpts[i] === allOpts[j]) {
                        hasDuplicate = true;
                        break;
                    }
                }
                if (hasDuplicate) break;
            }
            if (hasDuplicate) {
                console.log(`⚠️ REJEITADA: Alternativas similares/idênticas`);
                rejectedCount++;
                continue;
            }

            // 5. Deduplicação no banco
            const { rows: existingQ } = await query(
                'SELECT id FROM questions WHERE stem = $1 LIMIT 1',
                [stem]
            );
            if (existingQ.length > 0) {
                console.log('⏩ Questão duplicada pulada.');
                continue;
            }

            // 6. Validar correct_option
            let correctOpt = (q.correct_option || q.correct_answer || 'A').toString().toUpperCase().replace(/[^A-E]/g, '');
            if (!correctOpt || correctOpt.length !== 1) correctOpt = 'A';
            if (correctOpt === 'E' && !optE) correctOpt = 'A';

            await query(`
                INSERT INTO questions (document_id, stem, option_a, option_b, option_c, option_d, option_e, correct_option, explanation, area)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                docId,
                stem,
                optA, optB, optC, optD, optE,
                correctOpt,
                q.explanation || 'Gerado via IA',
                q.area || 'Geral'
            ]);
            savedCount++;
        }

        if (rejectedCount > 0) {
            console.log(`⚠️ ${rejectedCount} questões rejeitadas por baixa qualidade`);
        }
        console.log(`✅ ${savedCount} questões de qualidade salvas no banco`);

        // === AUTO-QUALITY FIX: Audita e conserta questões recém-salvas ===
        if (savedCount > 0 && docId) {
            try {
                console.log('🔍 [AUTO-FIX] Auditando questões recém-salvas...');
                const { rows: newQuestions } = await query(
                    `SELECT id, stem, option_a, option_b, option_c, option_d, option_e, correct_option, explanation, area
                     FROM questions WHERE document_id = $1`,
                    [docId]
                );

                const toFix: any[] = [];
                for (const nq of newQuestions) {
                    const nStem = nq.stem || '';
                    let reason = '';
                    const fc = nStem.trim()[0];
                    if (fc && fc === fc.toLowerCase() && fc !== fc.toUpperCase() && !/^\d/.test(nStem.trim())) reason = 'ENUNCIADO_CORTADO';
                    if (!reason && nStem.length < 30) reason = 'ENUNCIADO_CURTO';
                    if (!reason && (!nq.option_a || !nq.option_b || !nq.option_c || !nq.option_d)) reason = 'ALTERNATIVAS_FALTANDO';
                    if (!reason) {
                        const opts = [nq.option_a, nq.option_b, nq.option_c, nq.option_d, nq.option_e]
                            .filter(Boolean).map((o: string) => o.toLowerCase().trim().replace(/[.,;:!?]+$/, ''));
                        for (let i = 0; i < opts.length && !reason; i++) {
                            for (let j = i + 1; j < opts.length; j++) {
                                if (opts[i] === opts[j]) { reason = 'ALTERNATIVAS_SIMILARES'; break; }
                                const shorter = opts[i].length < opts[j].length ? opts[i] : opts[j];
                                const longer = opts[i].length >= opts[j].length ? opts[i] : opts[j];
                                if (shorter.length > 10 && longer.includes(shorter.substring(0, Math.floor(shorter.length * 0.8)))) {
                                    reason = 'ALTERNATIVAS_SIMILARES'; break;
                                }
                            }
                        }
                    }
                    if (reason) toFix.push({ ...nq, reason });
                }

                if (toFix.length > 0) {
                    console.log(`🔧 [AUTO-FIX] ${toFix.length} questões precisam de conserto. Corrigindo com ${GPT_MODEL}...`);
                    const { OpenAI: AutoFixOpenAI } = await import('openai');
                    const fixAi = new AutoFixOpenAI({ apiKey: process.env.OPENAI_API_KEY });

                    for (let bi = 0; bi < toFix.length; bi += 3) {
                        const batch = toFix.slice(bi, bi + 3);
                        const fixPrompt = `Conserte as questões abaixo. Problemas: ENUNCIADO_CORTADO, ENUNCIADO_CURTO, ALTERNATIVAS_SIMILARES, ALTERNATIVAS_FALTANDO.
REGRAS: Mantenha o gabarito. Stem com maiúscula. Alternativas TODAS diferentes.
QUESTÕES: ${JSON.stringify(batch.map((b: any, idx: number) => ({ index: idx, reason: b.reason, stem: b.stem, option_a: b.option_a, option_b: b.option_b, option_c: b.option_c, option_d: b.option_d, option_e: b.option_e, correct_option: b.correct_option })), null, 2)}
Retorne JSON: { "fixed_questions": [{ "index": 0, "stem": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "option_e": null, "correct_option": "...", "explanation": "...", "area": "..." }] }`;

                        try {
                            const fixResult = await fixAi.chat.completions.create({
                                model: GPT_MODEL,
                                messages: [{ role: 'system', content: 'Conserte questões médicas. Retorne APENAS JSON.' }, { role: 'user', content: fixPrompt }],
                                response_format: { type: 'json_object' },
                                temperature: 0.4,
                            });
                            const fixedQs = JSON.parse(fixResult.choices[0].message.content || '{}').fixed_questions || [];
                            for (const fq of fixedQs) {
                                const orig = batch[fq.index];
                                if (!orig) continue;
                                await query(
                                    `UPDATE questions SET stem=$1, option_a=$2, option_b=$3, option_c=$4, option_d=$5, option_e=$6, correct_option=$7, explanation=$8, area=$9 WHERE id=$10`,
                                    [fq.stem || orig.stem, fq.option_a || orig.option_a, fq.option_b || orig.option_b, fq.option_c || orig.option_c, fq.option_d || orig.option_d, fq.option_e || orig.option_e, fq.correct_option || orig.correct_option, fq.explanation || orig.explanation, fq.area || orig.area, orig.id]
                                );
                            }
                            console.log(`   ✅ ${fixedQs.length} questões auto-corrigidas`);
                        } catch (fixErr: any) {
                            console.error(`   ❌ Erro no auto-fix:`, fixErr.message);
                        }
                    }
                    console.log(`✅ [AUTO-FIX] Pipeline de qualidade concluído.`);
                } else {
                    console.log('✅ [AUTO-FIX] Todas as questões passaram na auditoria!');
                }
            } catch (auditErr: any) {
                console.error('⚠️ [AUTO-FIX] Erro na auditoria:', auditErr.message);
            }
        }

        // === DB SYNC: Verificar integridade do banco ===
        try {
            const { verifyDbSyncAction } = await import('./admin-actions');
            const syncResult = await verifyDbSyncAction();
            console.log(`🔄 [DB-SYNC] Documentos: ${syncResult.summary?.documents}, Questões: ${syncResult.summary?.questions}, Embeddings: ${syncResult.summary?.embeddings}`);
            if (syncResult.fixes && syncResult.fixes.length > 0) {
                console.log(`🔧 [DB-SYNC] Correções: ${syncResult.fixes.join(', ')}`);
            }
        } catch (syncErr: any) {
            console.error('⚠️ [DB-SYNC] Erro:', syncErr.message);
        }

        return { success: true, count: savedCount, rejected: rejectedCount };

    } catch (error: any) {
        console.error('Ingest Error:', error);
        return { success: false, error: error.message };
    }
}
