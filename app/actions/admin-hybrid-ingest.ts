'use server';

import { storageService } from '@/lib/storage';
import { aiService } from '@/lib/ai-service';
import { query } from '@/lib/db';
import { GPT_MODEL } from '@/lib/model-config';
import AdmZip from 'adm-zip';
import pdfParse from 'pdf-parse';

export async function ingestUnifiedAction(params: { fileKey: string; fileName: string; publicUrl: string }) {
    console.log(`🚀 Ingestão Unificada Iniciada: ${params.fileName}`);
    const results = {
        processedFiles: 0,
        questionsGenerated: 0,
        ragChunks: 0,
        errors: [] as string[]
    };

    try {
        // 1. Download do S3
        const downloadUrl = await storageService.getDownloadUrl(params.fileKey);
        const response = await fetch(downloadUrl);
        const arrayBuffer = await response.arrayBuffer();
        const mainBuffer = Buffer.from(arrayBuffer);

        // 2. Detectar se é ZIP ou Arquivo Único
        const lowerName = params.fileName.toLowerCase();
        let filesToProcess: { name: string, buffer: Buffer }[] = [];

        if (lowerName.endsWith('.zip')) {
            console.log('📦 Arquivo ZIP detectado. Extraindo...');
            try {
                const zip = new AdmZip(mainBuffer);
                const zipEntries = zip.getEntries();

                zipEntries.forEach(entry => {
                    if (!entry.isDirectory && entry.entryName.toLowerCase().endsWith('.pdf')) {
                        filesToProcess.push({
                            name: entry.entryName,
                            buffer: entry.getData()
                        });
                    }
                });
                console.log(`📦 ZIP extraído: ${filesToProcess.length} PDFs encontrados.`);
            } catch (e: any) {
                throw new Error(`Erro ao abrir ZIP: ${e.message}`);
            }
        } else if (lowerName.endsWith('.pdf')) {
            filesToProcess.push({ name: params.fileName, buffer: mainBuffer });
        } else {
            throw new Error('Formato não suportado. Apenas PDF ou ZIP com PDFs.');
        }

        // 3. Processar cada arquivo
        for (const file of filesToProcess) {
            try {
                console.log(`Processing file: ${file.name}`);

                // A. Extrair Texto com PDF-Parse
                let textContent = '';
                try {
                    const pdfData = await pdfParse(file.buffer);
                    textContent = pdfData.text;
                } catch (parseErr: any) {
                    results.errors.push(`${file.name}: Falha na leitura do PDF - ${parseErr.message}`);
                    continue;
                }

                // Limpeza básica
                textContent = textContent.replace(/\s+/g, ' ').trim();

                // CHECK: Se for vazio, é scan/imagem
                if (!textContent || textContent.length < 50) {
                    const msg = `⚠️ ${file.name}: ARQUIVO É UMA IMAGEM/XEROX. O sistema só lê PDFs com texto selecionável.`;
                    console.warn(msg);
                    results.errors.push(msg);
                    continue;
                }

                // --- FLOW 1: RAG (KNOWLEDGE BASE) → DigitalOcean ---

                // 1.1 Deduplicação de Documento
                const { rows: existingDocs } = await query(
                    'SELECT id FROM documents WHERE title = $1 LIMIT 1',
                    [file.name]
                );

                let docId = existingDocs[0]?.id;

                if (!docId) {
                    // Detectar instituição do nome do arquivo
                    const institution = file.name.toLowerCase().includes('enare') ? 'ENARE' :
                        file.name.toLowerCase().includes('usp') ? 'USP-SP' :
                            file.name.toLowerCase().includes('unicamp') ? 'UNICAMP' : 'Outras';

                    const yearMatch = file.name.match(/20(\d{2})/);
                    const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : new Date().getFullYear();

                    const { rows: newDoc } = await query(`
                        INSERT INTO documents (title, type, institution, year, pdf_url, processed, metadata)
                        VALUES ($1, $2, $3, $4, $5, TRUE, $6)
                        RETURNING id
                    `, [
                        file.name,
                        'PROVA',
                        institution,
                        year,
                        params.publicUrl,
                        JSON.stringify({ source_zip: params.fileName, internal_path: file.name })
                    ]);
                    docId = newDoc[0].id;
                    console.log(`📄 Documento criado: ${docId}`);
                } else {
                    console.log(`📄 Documento já existe (ID: ${docId}). Pulando criação...`);
                }

                // 1.2 RAG Embeddings (Knowledge Snowball)
                if (docId) {
                    const chunks = aiService.chunkText(textContent, 1000);
                    results.ragChunks += chunks.length;

                    const institution = file.name.toLowerCase().includes('enare') ? 'ENARE' :
                        file.name.toLowerCase().includes('usp') ? 'USP-SP' :
                            file.name.toLowerCase().includes('unicamp') ? 'UNICAMP' : 'Outras';
                    const yearMatch = file.name.match(/20(\d{2})/);
                    const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : new Date().getFullYear();

                    for (let ci = 0; ci < chunks.length; ci++) {
                        try {
                            const embedding = await aiService.generateEmbedding(chunks[ci]);
                            const embeddingStr = `[${embedding.join(',')}]`;
                            await query(`
                                INSERT INTO document_embeddings (document_id, content, embedding, metadata)
                                VALUES ($1, $2, $3, $4)
                            `, [
                                docId,
                                chunks[ci],
                                embeddingStr,
                                JSON.stringify({
                                    filename: file.name,
                                    institution,
                                    year,
                                    type: 'PROVA',
                                    chunk_index: ci,
                                    total_chunks: chunks.length,
                                    source: 'auto_ingest'
                                })
                            ]);
                        } catch (embErr) {
                            console.error('Erro gerando embedding:', embErr);
                        }
                    }
                    console.log(`✅ ${chunks.length} embeddings salvos para RAG (${institution} ${year})`);
                }

                // --- FLOW 2: QUESTION FACTORY (GPT-4o) → DigitalOcean ---
                const { OpenAI } = await import('openai');
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

                // Enviar mais texto para GPT (30k chars), cortando em fim de frase para não truncar questões
                const maxChars = 30000;
                let textForGPT = textContent.slice(0, maxChars);
                if (textContent.length > maxChars) {
                    // Cortar no último ponto final para não cortar questão no meio
                    const lastPeriod = textForGPT.lastIndexOf('.');
                    if (lastPeriod > maxChars * 0.8) textForGPT = textForGPT.slice(0, lastPeriod + 1);
                }

                const prompt = `
ANALISE O TEXTO ABAIXO E GERE/EXTRAIA QUESTÕES DE RESIDÊNCIA MÉDICA.

1. Se for uma PROVA: Extraia as questões existentes fielmente.
2. Se for MATERIAL DE ESTUDO (Apostila, Resumo): GERE questões de múltipla escolha baseadas no conteúdo.

Regras CRÍTICAS:
- Gere no máximo 15 questões de alta qualidade por arquivo.
- DISTRIBUA o gabarito: use A, B, C, D e E de forma equilibrada.
- NÃO coloque a resposta sempre na mesma letra.
- ENUNCIADO COMPLETO: O stem deve conter o enunciado COMPLETO da questão. NUNCA corte no meio da frase.
  Se um caso clínico precede a pergunta, INCLUA o caso clínico inteiro no stem.
  O stem deve começar com letra maiúscula e terminar com ponto de interrogação ou dois-pontos.
- ALTERNATIVAS DIFERENTES: Cada alternativa deve ser SUBSTANCIALMENTE diferente das outras.
  NUNCA repita o mesmo texto em duas alternativas.
  NUNCA use alternativas que são versões levemente diferentes da mesma frase.
- Cada questão deve ter 5 alternativas (A-E) quando possível, ou mínimo 4 (A-D).
- Inclua explicação médica detalhada para cada resposta correta.
- Identifique a área médica da questão.

Formato JSON estrito:
{
    "questions": [
        {
            "stem": "Texto COMPLETO do enunciado, incluindo caso clínico se houver...",
            "option_a": "Alternativa A",
            "option_b": "Alternativa B (deve ser diferente de A, C, D, E)", 
            "option_c": "Alternativa C",
            "option_d": "Alternativa D",
            "option_e": "Alternativa E",
            "correct_option": "C",
            "explanation": "Explicação detalhada...",
            "area": "Clínica Médica"
        }
    ]
}

TEXTO:
${textForGPT}
                `;

                const completion = await openai.chat.completions.create({
                    model: GPT_MODEL,
                    messages: [
                        { role: "system", content: "Você é um gerador de questões médicas de residência. Retorne apenas JSON válido. Distribua as respostas corretas entre A, B, C, D e E de forma equilibrada." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                });

                const jsonContent = completion.choices[0].message.content;
                const parsed = JSON.parse(jsonContent || '{}');
                let questions = [];

                if (Array.isArray(parsed)) questions = parsed;
                else if (parsed.questions && Array.isArray(parsed.questions)) questions = parsed.questions;

                if (questions.length > 0) {
                    let savedCount = 0;
                    let rejectedCount = 0;
                    for (const q of questions) {
                        const stem = q.stem || q.question_text || '';

                        // === VALIDAÇÃO DE QUALIDADE AUTOMÁTICA ===

                        // 1. Stem muito curto ou vazio
                        if (!stem || stem.length < 30) {
                            console.log(`⚠️ REJEITADA: Enunciado muito curto (${stem.length} chars)`);
                            rejectedCount++;
                            continue;
                        }

                        // 2. Stem cortado (começa com letra minúscula = fragmento)
                        const firstChar = stem.trim()[0];
                        if (firstChar && firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase()) {
                            console.log(`⚠️ REJEITADA: Enunciado parece cortado (começa com '${stem.substring(0, 50)}...')`);
                            rejectedCount++;
                            continue;
                        }

                        // 3. Alternativas obrigatórias
                        const optA = q.option_a || q.options?.a || '';
                        const optB = q.option_b || q.options?.b || '';
                        const optC = q.option_c || q.options?.c || '';
                        const optD = q.option_d || q.options?.d || '';
                        const optE = q.option_e || q.options?.e || null;

                        if (!optA || !optB || !optC || !optD) {
                            console.log(`⚠️ REJEITADA: Alternativas faltando (A-D obrigatórias)`);
                            rejectedCount++;
                            continue;
                        }

                        // 4. Detectar alternativas duplicadas/muito similares
                        const allOpts = [optA, optB, optC, optD, optE].filter(Boolean).map((o: string) => o.toLowerCase().trim().replace(/[.,;:!?]+$/, ''));
                        let hasDuplicate = false;
                        for (let i = 0; i < allOpts.length; i++) {
                            for (let j = i + 1; j < allOpts.length; j++) {
                                // Similaridade: se uma opção contém >80% do texto da outra
                                const shorter = allOpts[i].length < allOpts[j].length ? allOpts[i] : allOpts[j];
                                const longer = allOpts[i].length >= allOpts[j].length ? allOpts[i] : allOpts[j];
                                if (shorter.length > 10 && longer.includes(shorter.substring(0, Math.floor(shorter.length * 0.8)))) {
                                    console.log(`⚠️ REJEITADA: Alternativas similares detectadas`);
                                    hasDuplicate = true;
                                    break;
                                }
                                if (allOpts[i] === allOpts[j]) {
                                    console.log(`⚠️ REJEITADA: Alternativas idênticas detectadas`);
                                    hasDuplicate = true;
                                    break;
                                }
                            }
                            if (hasDuplicate) break;
                        }
                        if (hasDuplicate) {
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

                        // Se correct_option é E mas não tem option_e, ajustar
                        if (correctOpt === 'E' && !optE) correctOpt = 'A';

                        // === SALVAR QUESTÃO VALIDADA ===
                        await query(`
                            INSERT INTO questions (document_id, stem, option_a, option_b, option_c, option_d, option_e, correct_option, explanation, area)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        `, [
                            docId,
                            stem,
                            optA,
                            optB,
                            optC,
                            optD,
                            optE,
                            correctOpt,
                            q.explanation || 'Gerado via IA',
                            q.area || 'Geral'
                        ]);
                        savedCount++;
                    }
                    results.questionsGenerated += savedCount;
                    if (rejectedCount > 0) {
                        console.log(`⚠️ ${rejectedCount} questões rejeitadas por baixa qualidade`);
                        (results as any).questionsRejected = ((results as any).questionsRejected || 0) + rejectedCount;
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

                                // Check truncated
                                const fc = nStem.trim()[0];
                                if (fc && fc === fc.toLowerCase() && fc !== fc.toUpperCase() && !/^\d/.test(nStem.trim())) {
                                    reason = 'ENUNCIADO_CORTADO';
                                }
                                // Check short
                                if (!reason && nStem.length < 30) reason = 'ENUNCIADO_CURTO';
                                // Check missing options
                                if (!reason && (!nq.option_a || !nq.option_b || !nq.option_c || !nq.option_d)) reason = 'ALTERNATIVAS_FALTANDO';
                                // Check similar options
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

                                // Get document context for GPT
                                let docContext = '';
                                try {
                                    const { rows: embRows } = await query(
                                        'SELECT content FROM document_embeddings WHERE document_id = $1 ORDER BY id LIMIT 3',
                                        [docId]
                                    );
                                    docContext = embRows.map((r: any) => r.content).join('\n\n').substring(0, 6000);
                                } catch { }

                                // Fix in batches of 3
                                for (let bi = 0; bi < toFix.length; bi += 3) {
                                    const batch = toFix.slice(bi, bi + 3);
                                    const fixPrompt = `Você é um especialista em questões de residência médica.
CONSERTE as questões abaixo. Cada uma tem um "reason" indicando o problema.
- ENUNCIADO_CORTADO: Reconstrua o enunciado completo.
- ENUNCIADO_CURTO: Expanda com contexto clínico.
- ALTERNATIVAS_SIMILARES: Reescreva alternativas para serem COMPLETAMENTE diferentes.
- ALTERNATIVAS_FALTANDO: Gere alternativas plausíveis.

REGRAS: Mantenha o gabarito. Stem com maiúscula. Alternativas TODAS diferentes.

CONTEXTO DO DOCUMENTO:
${docContext}

QUESTÕES:
${JSON.stringify(batch.map((b: any, idx: number) => ({ index: idx, reason: b.reason, stem: b.stem, option_a: b.option_a, option_b: b.option_b, option_c: b.option_c, option_d: b.option_d, option_e: b.option_e, correct_option: b.correct_option, explanation: b.explanation, area: b.area })), null, 2)}

Retorne JSON: { "fixed_questions": [{ "index": 0, "stem": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "option_e": "..." ou null, "correct_option": "...", "explanation": "...", "area": "..." }] }`;

                                    try {
                                        const fixResult = await openai.chat.completions.create({
                                            model: GPT_MODEL,
                                            messages: [
                                                { role: 'system', content: 'Conserte questões médicas. Retorne APENAS JSON válido.' },
                                                { role: 'user', content: fixPrompt }
                                            ],
                                            response_format: { type: 'json_object' },
                                            temperature: 0.4,
                                        });

                                        const fixParsed = JSON.parse(fixResult.choices[0].message.content || '{}');
                                        const fixedQs = fixParsed.fixed_questions || [];

                                        for (const fq of fixedQs) {
                                            const orig = batch[fq.index];
                                            if (!orig) continue;
                                            await query(`
                                                UPDATE questions SET stem=$1, option_a=$2, option_b=$3, option_c=$4, option_d=$5, option_e=$6, correct_option=$7, explanation=$8, area=$9 WHERE id=$10
                                            `, [fq.stem || orig.stem, fq.option_a || orig.option_a, fq.option_b || orig.option_b, fq.option_c || orig.option_c, fq.option_d || orig.option_d, fq.option_e || orig.option_e, fq.correct_option || orig.correct_option, fq.explanation || orig.explanation, fq.area || orig.area, orig.id]);
                                        }
                                        console.log(`   ✅ ${fixedQs.length} questões auto-corrigidas (batch ${Math.floor(bi / 3) + 1})`);
                                    } catch (fixErr: any) {
                                        console.error(`   ❌ Erro no auto-fix:`, fixErr.message);
                                    }
                                }
                                (results as any).questionsAutoFixed = toFix.length;
                                console.log(`✅ [AUTO-FIX] Pipeline de qualidade concluído.`);
                            } else {
                                console.log('✅ [AUTO-FIX] Todas as questões passaram na auditoria!');
                            }
                        } catch (auditErr: any) {
                            console.error('⚠️ [AUTO-FIX] Erro na auditoria:', auditErr.message);
                        }
                    }
                }

                results.processedFiles++;

            } catch (innerErr: any) {
                console.error(`Erro processando arquivo interno ${file.name}:`, innerErr);
                results.errors.push(`${file.name}: ${innerErr.message}`);
            }
        }

        // === DB SYNC: Verificar integridade do banco ===
        try {
            const { verifyDbSyncAction } = await import('./admin-actions');
            const syncResult = await verifyDbSyncAction();
            (results as any).dbSync = syncResult;
            console.log(`🔄 [DB-SYNC] Documentos: ${syncResult.summary?.documents}, Questões: ${syncResult.summary?.questions}, Embeddings: ${syncResult.summary?.embeddings}`);
            if (syncResult.fixes && syncResult.fixes.length > 0) {
                console.log(`🔧 [DB-SYNC] Correções: ${syncResult.fixes.join(', ')}`);
            }
        } catch (syncErr: any) {
            console.error('⚠️ [DB-SYNC] Erro:', syncErr.message);
        }

        // === TRIGGER PUSH NOTIFICATION DE CONTEÚDO NOVO ===
        if (results.processedFiles > 0) {
            try {
                const { sendManualPushNotificationAction } = await import('./admin-actions');

                const pushTitle = "📚 Novo Conteúdo no Ar!";
                const pushMessage = results.processedFiles > 1
                    ? `Adicionamos ${results.processedFiles} novos documentos e ${results.questionsGenerated} novas questões no app! Bora treinar?`
                    : `Acabamos de adicionar o material: "${params.fileName.replace('.pdf', '')}". Venha conferir!`;

                await sendManualPushNotificationAction(pushTitle, pushMessage);
                console.log('✅ [PUSH] Notificação de novo upload disparada automaticamente.');
            } catch (pushErr: any) {
                console.error('⚠️ [PUSH] Erro ao enviar notificação de upload:', pushErr.message);
            }
        }

        return { success: true, results };

    } catch (error: any) {
        console.error('Unified Ingest Error:', error);
        return { success: false, error: error.message };
    }
}
