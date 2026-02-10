
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pdf from 'pdf-parse';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
    console.error('Missing environment variables. Check .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

// Directory containing PDFs to ingest
const KNOWLEDGE_DIR = path.resolve(process.cwd(), 'knowledge_base');

async function ingestKnowledge() {
    console.log('📚 Starting Knowledge Ingestion...');

    if (!fs.existsSync(KNOWLEDGE_DIR)) {
        console.log(`Creating directory: ${KNOWLEDGE_DIR}`);
        fs.mkdirSync(KNOWLEDGE_DIR);
        console.log('⚠️ Please put your PDF files in the "knowledge_base" folder and run this script again.');
        return;
    }

    const files = fs.readdirSync(KNOWLEDGE_DIR).filter(file => file.toLowerCase().endsWith('.pdf'));

    if (files.length === 0) {
        console.log('⚠️ No PDF files found in "knowledge_base" folder.');
        return;
    }

    console.log(`Found ${files.length} PDF(s) to process.`);

    for (const file of files) {
        await processFile(file);
    }

    console.log('✅ Ingestion complete!');
}

async function processFile(fileName: string) {
    const filePath = path.join(KNOWLEDGE_DIR, fileName);
    console.log(`\n📄 Processing: ${fileName}`);

    // check if already ingested
    let existing = null;
    try {
        const result = await supabase
            .from('knowledge_docs')
            .select('id')
            .eq('file_name', fileName)
            .single();
        existing = result.data;
    } catch (e) {
        // Ignorar erro se for apenas "Row not found", mas se for tabela inexistente, avisar.
    }

    // Check for specific error indicating table doesn't exist
    // Supabase JS often returns error in the { error } object, not throw.
    const { data: checkData, error: checkError } = await supabase.from('knowledge_docs').select('id').limit(1);
    if (checkError && checkError.code === '42P01') { // undefined_table
        console.error('\n❌ ERRO: A tabela "knowledge_docs" não existe.');
        console.error('👉 Por favor, vá no Supabase > SQL Editor e rode o código do passo 1 do guia.');
        console.error('   (Veja o arquivo GUIA_BASE_CONHECIMENTO.md)\n');
        process.exit(1);
    }

    if (existing) {
        console.log('   ⏭️ Already ingested. Skipping.');
        return;
    }

    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        const text = data.text;

        console.log(`   📝 Parsed ${text.length} characters.`);

        // 1. Save Document Metadata
        const { data: doc, error: docError } = await supabase
            .from('knowledge_docs')
            .insert({
                title: fileName.replace('.pdf', ''),
                file_name: fileName,
                file_type: 'pdf',
                source_url: filePath
            })
            .select()
            .single();

        if (docError) {
            console.error('   ❌ Error saving doc metadata:', docError);
            return;
        }

        console.log(`   💾 Saved metadata (ID: ${doc.id})`);

        // 2. Chunk Text
        const chunks = splitTextIntoChunks(text, 1000, 200); // 1000 chars, 200 overlap
        console.log(`   🔪 Split into ${chunks.length} chunks.`);

        // 3. Generate Embeddings & Save
        let savedChunks = 0;
        const BATCH_SIZE = 10;

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);

            const embeddings = await Promise.all(batch.map(async (chunk) => {
                const response = await openai.embeddings.create({
                    model: 'text-embedding-3-small',
                    input: chunk.replace(/\n/g, ' '),
                    dimensions: 1536,
                });
                return response.data[0].embedding;
            }));

            const rowsToInsert = batch.map((chunk, idx) => ({
                doc_id: doc.id,
                content: chunk,
                embedding: embeddings[idx]
            }));

            const { error: chunkError } = await supabase
                .from('knowledge_embeddings')
                .insert(rowsToInsert);

            if (chunkError) {
                console.error(`   ❌ Error saving batch ${i}:`, chunkError);
            } else {
                savedChunks += batch.length;
                process.stdout.write(`   ...saved ${savedChunks}/${chunks.length}\r`);
            }
        }
        console.log(`\n   ✨ Finished processing ${fileName}`);

    } catch (err) {
        console.error(`   ❌ Error processing file:`, err);
    }
}

function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    // Clean text: remove excessive newlines/spaces
    const cleanText = text.replace(/\s+/g, ' ').trim();

    while (start < cleanText.length) {
        const end = Math.min(start + chunkSize, cleanText.length);
        let chunk = cleanText.substring(start, end);

        // Try to break at a sentence or word if possible
        if (end < cleanText.length) {
            const lastPeriod = chunk.lastIndexOf('.');
            const lastSpace = chunk.lastIndexOf(' ');

            if (lastPeriod > chunkSize * 0.5) {
                chunk = chunk.substring(0, lastPeriod + 1);
            } else if (lastSpace > chunkSize * 0.5) {
                chunk = chunk.substring(0, lastSpace);
            }
        }

        chunks.push(chunk);
        start += chunk.length - overlap;
    }

    return chunks;
}

ingestKnowledge();
