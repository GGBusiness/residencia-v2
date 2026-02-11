
import { Pool } from 'pg';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pdf from 'pdf-parse';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.DIGITALOCEAN_DB_URL!;
const openaiKey = process.env.OPENAI_API_KEY!;

if (!dbUrl || !openaiKey) {
    console.error('Missing environment variables. Check .env.local (DIGITALOCEAN_DB_URL, OPENAI_API_KEY)');
    process.exit(1);
}

// Aggressive SSL fix for DigitalOcean
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({ apiKey: openaiKey });

// Directory containing PDFs to ingest
const KNOWLEDGE_DIR = path.resolve(process.cwd(), 'knowledge_base');

async function ingestKnowledge() {
    console.log('📚 Starting Knowledge Ingestion (DigitalOcean)...');

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

    try {
        // Initializing vector extension if possible
        await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    } catch (e) {
        console.warn('⚠️ Could not ensure "vector" extension. Make sure your PG supports pgvector.');
    }

    for (const file of files) {
        await processFile(file);
    }

    console.log('\n✅ Ingestion complete!');
    await pool.end();
}

async function processFile(fileName: string) {
    const filePath = path.join(KNOWLEDGE_DIR, fileName);
    console.log(`\n📄 Processing: ${fileName}`);

    // check if already ingested
    try {
        const { rows } = await pool.query('SELECT id FROM knowledge_docs WHERE file_name = $1', [fileName]);
        if (rows.length > 0) {
            console.log('   ⏭️ Already ingested. Skipping.');
            return;
        }
    } catch (e: any) {
        if (e.code === '42P01') {
            console.error('\n❌ ERRO: A tabela "knowledge_docs" não existe no banco DigitalOcean.');
            console.error('👉 Rode o conteúdo de scripts/setup-knowledge.sql primeiro.\n');
            process.exit(1);
        }
    }

    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        const text = data.text;

        console.log(`   📝 Parsed ${text.length} characters.`);

        // 1. Save Document Metadata
        const { rows: docRows } = await pool.query(`
            INSERT INTO knowledge_docs (title, file_name, file_type, source_url)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [fileName.replace('.pdf', ''), fileName, 'pdf', filePath]);

        const docId = docRows[0].id;
        console.log(`   💾 Saved metadata (ID: ${docId})`);

        // 2. Chunk Text
        const chunks = splitTextIntoChunks(text, 1000, 200);
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

            // PG expects [1,2,3] format for vectors
            for (let j = 0; j < batch.length; j++) {
                await pool.query(`
                    INSERT INTO knowledge_embeddings (doc_id, content, embedding)
                    VALUES ($1, $2, $3)
                `, [docId, batch[j], JSON.stringify(embeddings[j])]);

                savedChunks++;
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

    const cleanText = text.replace(/\s+/g, ' ').trim();

    while (start < cleanText.length) {
        const end = Math.min(start + chunkSize, cleanText.length);
        let chunk = cleanText.substring(start, end);

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
