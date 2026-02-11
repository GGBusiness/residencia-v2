'use server';

import { storageService } from '@/lib/storage';
import { aiService } from '@/lib/ai-service';
import { createServerClient } from '@/lib/supabase';
import AdmZip from 'adm-zip';

// Helper to ensure PDF-Parse loads correctly
async function loadPdfParse() {
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
    return pdfParse;
}

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

        // 3. Processar cada arquivo (Loop)
        const pdfParse = await loadPdfParse();
        const supabase = createServerClient();

        for (const file of filesToProcess) {
            try {
                console.log(`Processing file: ${file.name}`);

                // A. Extrair Texto
                const pdfData = await pdfParse(file.buffer);
                const textContent = pdfData.text;

                if (!textContent || textContent.length < 50) {
                    results.errors.push(`${file.name}: Texto insuficiente.`);
                    continue;
                }

                // --- FLOW 1: RAG (KNOWLEDGE BASE) ---
                // Salvar documento no banco
                const { data: docData, error: docError } = await supabase
                    .from('documents')
                    .insert({
                        title: file.name,
                        doc_type: 'hybrid_ingest',
                        file_path: params.publicUrl, // Nota: Se for ZIP, todos apontam pro ZIP original por enquanto
                        metadata: { source_zip: params.fileName, internal_path: file.name },
                        year: new Date().getFullYear()
                    })
                    .select()
                    .single();

                if (!docError && docData) {
                    const chunks = aiService.chunkText(textContent, 1000);
                    results.ragChunks += chunks.length;

                    // Salvar Embeddings (Batch Limitado)
                    const embeddingsToInsert = [];
                    for (const chunk of chunks) {
                        const embedding = await aiService.generateEmbedding(chunk);
                        embeddingsToInsert.push({
                            document_id: docData.id,
                            content: chunk,
                            embedding,
                            metadata: { filename: file.name }
                        });
                    }

                    // Insert in batches of 50
                    for (let i = 0; i < embeddingsToInsert.length; i += 50) {
                        const batch = embeddingsToInsert.slice(i, i + 50);
                        await supabase.from('document_embeddings').insert(batch);
                    }
                }

                // --- FLOW 2: QUESTION FACTORY (GPT-4o) ---
                const { OpenAI } = await import('openai');
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

                const prompt = `
                    ANALISE O TEXTO ABAIXO E GERE/EXTRAIA QUESTÕES.
                    
                    1. Se for uma PROVA: Extraia as questões existentes.
                    2. Se for MATERIAL DE ESTUDO (Apostila, Resumo): GERE questões baseadas no conteúdo.

                    Regras:
                    - Gere no máximo 10 questões de alta qualidade por arquivo (para não estourar tokens).
                    - Formato JSON estrito.
                    - Campos obrigatórios: question_text, options (a,b,c,d,e), correct_answer, explanation.

                    TEXTO (Início):
                    ${textContent.slice(0, 15000)}... (truncado)
                `;

                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "Você é um gerador de questões médicas. Retorne JSON array puro." },
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
                    const questionsToSave = questions.map((q: any) => ({
                        institution: file.name.includes('ENARE') ? 'ENARE' : 'App-Generated',
                        year: new Date().getFullYear(),
                        area: q.area || 'Geral',
                        question_text: q.question_text,
                        option_a: q.option_a || q.options?.a,
                        option_b: q.option_b || q.options?.b,
                        option_c: q.option_c || q.options?.c,
                        option_d: q.option_d || q.options?.d,
                        option_e: q.option_e || q.options?.e || null,
                        correct_answer: q.correct_answer || 'A',
                        explanation: q.explanation || 'Gerado via IA',
                        created_at: new Date().toISOString()
                    }));

                    const { error: qError } = await supabase.from('questions').insert(questionsToSave);
                    if (!qError) {
                        results.questionsGenerated += questions.length;
                    } else {
                        results.errors.push(`${file.name}: Erro ao salvar questões - ${qError.message}`);
                    }
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
