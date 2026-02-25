'use server';

import { storageService } from '@/lib/storage';
import { aiService } from '@/lib/ai-service';
import { query } from '@/lib/db';

export async function ingestKnowledgeAction(params: { fileKey: string; fileName: string; publicUrl: string }) {
    console.log(`🧠 Iniciando aprendizado: ${params.fileName}`);

    try {
        // 1. Baixar arquivo do S3
        const downloadUrl = await storageService.getDownloadUrl(params.fileKey);
        const response = await fetch(downloadUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Extrair Texto
        let textContent = '';
        const lowerName = params.fileName.toLowerCase();

        if (lowerName.endsWith('.pdf')) {
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
            if (typeof pdfParse !== 'function') throw new Error('PDF Parse lib failed');

            const data = await pdfParse(buffer);
            textContent = data.text;

        } else if (lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
            textContent = buffer.toString('utf-8');
        } else {
            return { success: true, message: 'Arquivo salvo, mas formato ainda não suportado para leitura automática.' };
        }

        if (!textContent || textContent.length < 50) {
            throw new Error('Texto insuficiente extraído do arquivo.');
        }

        console.log(`   📄 Texto extraído: ${textContent.length} chars`);

        // 3. Chunking & Embedding → DigitalOcean PostgreSQL
        const chunks = aiService.chunkText(textContent, 1000);
        console.log(`   ✂️ Gerados ${chunks.length} chunks`);

        // Criar registro do Documento
        const { rows: docData } = await query(`
            INSERT INTO documents (title, type, pdf_url, metadata, year, processed)
            VALUES ($1, $2, $3, $4, $5, TRUE)
            RETURNING id
        `, [
            params.fileName,
            'KNOWLEDGE',
            params.publicUrl,
            JSON.stringify({ key: params.fileKey, source: 'admin_upload' }),
            new Date().getFullYear()
        ]);

        const docId = docData[0].id;

        // Gerar Embeddings e salvar no DigitalOcean
        let savedChunks = 0;
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
                    JSON.stringify({ source: params.fileName })
                ]);
                savedChunks++;
            } catch (embErr) {
                console.error('Error generating/saving embedding:', embErr);
            }
        }

        console.log(`   ✅ ${savedChunks}/${chunks.length} embeddings salvos`);

        return { success: true, chunks: savedChunks, documentId: docId };

    } catch (error: any) {
        console.error('Knowledge Ingest Error:', error);
        return { success: false, error: error.message };
    }
}
