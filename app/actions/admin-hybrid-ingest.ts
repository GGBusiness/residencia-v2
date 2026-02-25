'use server';

import { storageService } from '@/lib/storage';
import { aiService } from '@/lib/ai-service';
import { query } from '@/lib/db';
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

                // 1.2 RAG Embeddings
                if (docId) {
                    const chunks = aiService.chunkText(textContent, 1000);
                    results.ragChunks += chunks.length;

                    for (const chunk of chunks) {
                        try {
                            const embedding = await aiService.generateEmbedding(chunk);
                            const embeddingStr = `[${embedding.join(',')}]`;
                            await query(`
                                INSERT INTO document_embeddings (document_id, content, embedding, metadata)
                                VALUES ($1, $2, $3, $4)
                            `, [
                                docId,
                                chunk,
                                embeddingStr,
                                JSON.stringify({ filename: file.name })
                            ]);
                        } catch (embErr) {
                            console.error('Erro gerando embedding:', embErr);
                        }
                    }
                    console.log(`✅ ${chunks.length} embeddings salvos para RAG`);
                }

                // --- FLOW 2: QUESTION FACTORY (GPT-4o) → DigitalOcean ---
                const { OpenAI } = await import('openai');
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

                const prompt = `
                    ANALISE O TEXTO ABAIXO E GERE/EXTRAIA QUESTÕES DE RESIDÊNCIA MÉDICA.
                    
                    1. Se for uma PROVA: Extraia as questões existentes fielmente.
                    2. Se for MATERIAL DE ESTUDO (Apostila, Resumo): GERE questões de múltipla escolha baseadas no conteúdo.

                    Regras OBRIGATÓRIAS:
                    - Gere no máximo 15 questões de alta qualidade por arquivo.
                    - DISTRIBUA o gabarito: use A, B, C, D e E de forma equilibrada.
                    - NÃO coloque a resposta sempre na mesma letra.
                    - Cada questão deve ter 5 alternativas (A-E) quando possível, ou mínimo 4 (A-D).
                    - Inclua explicação médica detalhada para cada resposta correta.
                    - Identifique a área médica da questão.
                    
                    Formato JSON estrito:
                    {
                        "questions": [
                            {
                                "stem": "Texto completo da questão...",
                                "option_a": "Alternativa A",
                                "option_b": "Alternativa B", 
                                "option_c": "Alternativa C",
                                "option_d": "Alternativa D",
                                "option_e": "Alternativa E",
                                "correct_option": "C",
                                "explanation": "Explicação detalhada...",
                                "area": "Clínica Médica"
                            }
                        ]
                    }

                    TEXTO (Início):
                    ${textContent.slice(0, 15000)}... (truncado)
                `;

                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
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
                    for (const q of questions) {
                        // Deduplicação: checar se questão com texto similar já existe
                        const stem = q.stem || q.question_text || '';
                        if (!stem || stem.length < 20) continue;

                        const { rows: existingQ } = await query(
                            'SELECT id FROM questions WHERE stem = $1 LIMIT 1',
                            [stem]
                        );

                        if (existingQ.length > 0) {
                            console.log('Questão duplicada pulada.');
                            continue;
                        }

                        // Validar correct_option
                        let correctOpt = (q.correct_option || q.correct_answer || 'A').toString().toUpperCase().replace(/[^A-E]/g, '');
                        if (!correctOpt || correctOpt.length !== 1) correctOpt = 'A';

                        await query(`
                            INSERT INTO questions (document_id, stem, option_a, option_b, option_c, option_d, option_e, correct_option, explanation, area)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        `, [
                            docId,
                            stem,
                            q.option_a || q.options?.a || '',
                            q.option_b || q.options?.b || '',
                            q.option_c || q.options?.c || '',
                            q.option_d || q.options?.d || '',
                            q.option_e || q.options?.e || null,
                            correctOpt,
                            q.explanation || 'Gerado via IA',
                            q.area || 'Geral'
                        ]);
                        savedCount++;
                    }
                    results.questionsGenerated += savedCount;
                    console.log(`✅ ${savedCount} questões salvas no banco`);
                }

                results.processedFiles++;

            } catch (innerErr: any) {
                console.error(`Erro processando arquivo interno ${file.name}:`, innerErr);
                results.errors.push(`${file.name}: ${innerErr.message}`);
            }
        }

        return { success: true, results };

    } catch (error: any) {
        console.error('Unified Ingest Error:', error);
        return { success: false, error: error.message };
    }
}
