'use server';

import { storageService } from '@/lib/storage';
import { aiService } from '@/lib/ai-service';
import { createServerClient } from '@/lib/supabase';
import { getPresignedUrlAction } from './storage-actions';

// Dynamic import for pdf-parse (Server Side only)
// Note: pdf-parse might need a specific handling in Next.js Server Actions similar to admin-ingest.ts

export async function ingestKnowledgeAction(params: { fileKey: string; fileName: string; publicUrl: string }) {
    console.log(`🧠 Iniciando aprendizado: ${params.fileName}`);

    try {
        // 1. Baixar arquivo do S3 (porque o upload foi direto do client)
        const downloadUrl = await storageService.getDownloadUrl(params.fileKey);
        const response = await fetch(downloadUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Extrair Texto
        let textContent = '';
        const lowerName = params.fileName.toLowerCase();

        if (lowerName.endsWith('.pdf')) {
            // Importação dinâmica do PDF Parse
            const pdfParseModule: any = await import('pdf-parse');
            let pdfParse = pdfParseModule.default || pdfParseModule;
            // Fallback para encontrar a função correta (igual ao admin-ingest.ts)
            if (typeof pdfParse !== 'function') {
                for (const key of Object.keys(pdfParseModule)) {
                    if (typeof pdfParseModule[key] === 'function') {
                        pdfParse = pdfParseModule[key];
                        break;
                    }
                }
            }
            if (typeof pdfParse !== 'function') throw new Error('PDF Parse lib failed');

            const data = await pdfParse(buffer);
            textContent = data.text;

        } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
            textContent = buffer.toString('utf-8');
        } else {
            // ZIP ou outros formatos (Placeholder for future)
            return { success: true, message: 'Arquivo salvo, mas formato ainda não suportado para leitura automática.' };
        }

        if (!textContent || textContent.length < 50) {
            throw new Error('Texto insuficiente extraído do arquivo.');
        }

        console.log(`   📄 Texto extraído: ${textContent.length} chars`);

        // 3. Chunking & Embedding
        const chunks = aiService.chunkText(textContent, 1000); // 1000 tokens aprox
        console.log(`   ✂️ Gerados ${chunks.length} chunks`);

        const supabase = createServerClient();

        // Criar registro do Documento Pai
        const { data: docData, error: docError } = await supabase
            .from('documents')
            .insert({
                title: params.fileName,
                doc_type: 'knowledge_base',
                file_path: params.publicUrl,
                metadata: { key: params.fileKey, source: 'admin_upload' },
                year: new Date().getFullYear(), // Default
                has_answer_key: false
            })
            .select()
            .single();

        if (docError) throw docError;

        // Gerar Embeddings erro a erro (sequencial para não estourar rate limit da OpenAI)
        const embeddingsToInsert = [];
        for (const chunk of chunks) {
            const embedding = await aiService.generateEmbedding(chunk);
            embeddingsToInsert.push({
                document_id: docData.id,
                content: chunk,
                embedding,
                metadata: { source: params.fileName }
            });
        }

        // Salvar Embeddings (Batch)
        // Se for muito grande, quebrar em batches menores. Supabase aguenta bem 100-200.
        const BATCH_SIZE = 50;
        for (let i = 0; i < embeddingsToInsert.length; i += BATCH_SIZE) {
            const batch = embeddingsToInsert.slice(i, i + BATCH_SIZE);
            const { error: embedError } = await supabase.from('document_embeddings').insert(batch);
            if (embedError) console.error('Error saving embeddings batch', embedError);
        }

        return { success: true, chunks: chunks.length, documentId: docData.id };

    } catch (error: any) {
        console.error('Knowledge Ingest Error:', error);
        return { success: false, error: error.message };
    }
}
