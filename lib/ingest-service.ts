'use server';

import { query } from '@/lib/db';
import OpenAI from 'openai';
import pdf from 'pdf-parse';
import { unstable_noStore as noStore } from 'next/cache';

// Knowledge Ingestion (Server-side PDF processing)
export async function ingestKnowledgeFile(formData: FormData) {
    noStore();

    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');
    if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI key missing');

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
        const data = await pdf(buffer);
        const text = data.text;
        const fileName = file.name;

        // 1. Meta
        const { rows: docRows } = await query(`
            INSERT INTO knowledge_docs (title, file_name, file_type, source_url)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [fileName.replace('.pdf', ''), fileName, 'pdf', 'web-upload']);

        const docId = docRows[0].id;

        // 2. Chunks
        const chunks: string[] = [];
        let start = 0;
        const cleanText = text.replace(/\s+/g, ' ').trim();
        const chunkSize = 1000;
        const overlap = 200;

        while (start < cleanText.length) {
            const end = Math.min(start + chunkSize, cleanText.length);
            let chunk = cleanText.substring(start, end);
            chunks.push(chunk);
            start += chunk.length - overlap;
        }

        // 3. Embeddings & Save (Batching to avoid timeouts)
        for (const chunk of chunks) {
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: chunk.replace(/\n/g, ' '),
                dimensions: 1536,
            });
            const embedding = response.data[0].embedding;

            await query(`
                INSERT INTO knowledge_embeddings (doc_id, content, embedding)
                VALUES ($1, $2, $3)
            `, [docId, chunk, JSON.stringify(embedding)]);
        }

        return { success: true, docId };
    } catch (error) {
        console.error('Ingestion error:', error);
        throw error;
    }
}
