'use server';

import { storageService } from '@/lib/storage';
import { aiService } from '@/lib/ai-service';
import { createServerClient } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
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

        // 3. Processar cada arquivo (Loop)
        // DEBUG: Verificar se as chaves estão carregadas
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('❌ ERRO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY não encontrada!');
            throw new Error('Configuração de Banco de Dados incompleta (Falta Service Key).');
        }
        console.log(`🔑 Service Key Loaded (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)`);

        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                },
                global: {
                    headers: { 'x-my-custom-header': 'admin-ingest' } // Debug helper
                }
            }
        );

        for (const file of filesToProcess) {
            try {
                console.log(`Processing file: ${file.name}`);

                // A. Extrair Texto com PDF-Parse (Estável)
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

                // CHECK: Se for vazio, é scan
                if (!textContent || textContent.length < 50) {
                    const msg = `⚠️ ${file.name}: ARQUIVO É UMA IMAGEM/XEROX. O sistema só lê PDFs com texto selecionável.`;
                    console.warn(msg);
                    results.errors.push(msg); // Adiciona ao log visível do usuário
                    continue; // Pula este arquivo
                }

                // --- FLOW 1: RAG (KNOWLEDGE BASE) ---

                // 1.1 Deduplicação de Documento
                // Verifica se já existe documento com este nome exato
                const { data: existingDoc } = await adminSupabase
                    .from('documents')
                    .select('id')
                    .eq('title', file.name)
                    .single();

                let docId = existingDoc?.id;

                if (!docId) {
                    // Inserir novo
                    const { data: docData, error: docError } = await adminSupabase
                        .from('documents')
                        .insert({
                            title: file.name,
                            doc_type: 'hybrid_ingest',
                            file_path: params.publicUrl,
                            metadata: { source_zip: params.fileName, internal_path: file.name },
                            year: new Date().getFullYear()
                        })
                        .select()
                        .single();

                    if (docError) {
                        console.error('Erro inserindo doc:', docError);
                        throw new Error(`Erro ao salvar documento: ${docError.message}`);
                    }
                    docId = docData.id;
                } else {
                    console.log(`📄 Documento já existe (ID: ${docId}). Pulando criação...`);
                    // Opcional: Limpar embeddings antigos se for re-ingestão?
                    // await adminSupabase.from('document_embeddings').delete().eq('document_id', docId);
                }

                if (docId) {
                    const chunks = aiService.chunkText(textContent, 1000);
                    results.ragChunks += chunks.length;

                    // Salvar Embeddings (Batch Limitado)
                    const embeddingsToInsert = [];
                    for (const chunk of chunks) {
                        try {
                            const embedding = await aiService.generateEmbedding(chunk);
                            embeddingsToInsert.push({
                                document_id: docId,
                                content: chunk,
                                embedding,
                                metadata: { filename: file.name }
                            });
                        } catch (embErr) {
                            console.error('Erro gerando embedding:', embErr);
                        }
                    }

                    // Insert in batches of 50
                    for (let i = 0; i < embeddingsToInsert.length; i += 50) {
                        const batch = embeddingsToInsert.slice(i, i + 50);
                        if (batch.length > 0) {
                            const { error: embInsertError } = await adminSupabase.from('document_embeddings').insert(batch);
                            if (embInsertError) console.error('Erro salvando embeddings:', embInsertError);
                        }
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
                    let savedCount = 0;
                    for (const q of questions) {
                        // Deduplicação de Questão
                        // Verifica se texto da questão já existe
                        const { data: existingQ } = await adminSupabase
                            .from('questions')
                            .select('id')
                            .eq('question_text', q.question_text)
                            .single();

                        if (existingQ) {
                            console.log('Questão duplicada pulada.');
                            continue;
                        }

                        const { error: qError } = await adminSupabase.from('questions').insert({
                            institution: file.name.includes('ENARE') ? 'ENARE' : 'App-Generated',
                            year: new Date().getFullYear(),
                            area: q.area || 'Geral',
                            question_text: q.question_text,
                            option_a: q.option_a || q.options?.a,
                            option_b: q.option_b || q.options?.b,
                            option_c: q.option_c || q.options?.c,
                            option_d: q.option_d || q.options?.d,
                            option_e: q.option_e || q.options?.e || null,
                            correct_answer: (q.correct_answer || 'A').toString().toUpperCase().replace(/[^A-E]/g, '') || 'A',
                            explanation: q.explanation || 'Gerado via IA',
                            created_at: new Date().toISOString()
                        });

                        if (!qError) savedCount++;
                        else results.errors.push(`${file.name}: Erro ao salvar questão - ${qError.message}`);
                    }
                    results.questionsGenerated += savedCount;
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
