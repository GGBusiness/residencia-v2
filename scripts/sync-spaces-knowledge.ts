
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pdf from 'pdf-parse';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const s3Client = new S3Client({
    endpoint: `https://${process.env.DO_SPACES_REGION}.digitaloceanspaces.com`,
    region: process.env.DO_SPACES_REGION,
    credentials: {
        accessKeyId: process.env.DO_SPACES_KEY!,
        secretAccessKey: process.env.DO_SPACES_SECRET!,
    },
});

const pool = new Pool({
    connectionString: process.env.DIGITALOCEAN_DB_URL,
    ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BUCKET = process.env.DO_SPACES_BUCKET!;

async function syncSpacesKnowledge() {
    console.log(`🚀 Sincronizando arquivos da nuvem (Bucket: ${BUCKET})...`);

    try {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: 'knowledge-base/', // Pasta na nuvem
        });

        const { Contents } = await s3Client.send(command);

        if (!Contents || Contents.length === 0) {
            console.log('ℹ️ Nenhum arquivo encontrado na pasta "knowledge-base/".');
            return;
        }

        const pdfs = Contents.filter(c => c.Key?.toLowerCase().endsWith('.pdf'));
        console.log(`📂 Encontrados ${pdfs.length} PDFs para processar.`);

        for (const pdfItem of pdfs) {
            await processCloudFile(pdfItem.Key!);
        }

        console.log('\n✅ Sincronização concluída!');
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
    } finally {
        await pool.end();
    }
}

async function processCloudFile(key: string) {
    const fileName = path.basename(key);
    console.log(`\n📄 Processando do Cloud: ${fileName}`);

    // Check DB
    const { rows } = await pool.query('SELECT id FROM knowledge_docs WHERE file_name = $1', [fileName]);
    if (rows.length > 0) {
        console.log('   ⏭️ Já ingerido. Pulando.');
        return;
    }

    try {
        // Download from S3
        const getCommand = new GetObjectCommand({ Bucket: BUCKET, Key: key });
        const response = await s3Client.send(getCommand);
        const body = await response.Body?.transformToByteArray();

        if (!body) return;

        const data = await pdf(Buffer.from(body));
        const text = data.text;

        // 1. Meta
        const { rows: docRows } = await pool.query(`
            INSERT INTO knowledge_docs (title, file_name, file_type, source_url)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [fileName.replace('.pdf', ''), fileName, 'pdf', `s3://${BUCKET}/${key}`]);

        const docId = docRows[0].id;

        // 2. Chunks & Embeddings (Abreviação do código anterior para brevidade)
        const chunks = splitTextIntoChunks(text, 1000, 200);
        console.log(`   🔪 Dividido em ${chunks.length} pedaços. Gerando inteligência...`);

        for (let i = 0; i < chunks.length; i++) {
            const aiResponse = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: chunks[i],
                dimensions: 1536,
            });
            const embedding = aiResponse.data[0].embedding;

            await pool.query(`
                INSERT INTO knowledge_embeddings (doc_id, content, embedding)
                VALUES ($1, $2, $3)
            `, [docId, chunks[i], JSON.stringify(embedding)]);

            process.stdout.write(`   ...processando ${i + 1}/${chunks.length}\r`);
        }
        console.log(`\n   ✨ Dr. IA aprendeu sobre: ${fileName}`);

    } catch (err) {
        console.error(`   ❌ Erro ao processar ${key}:`, err);
    }
}

function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    const cleanText = text.replace(/\s+/g, ' ').trim();
    while (start < cleanText.length) {
        const end = Math.min(start + chunkSize, cleanText.length);
        let chunk = cleanText.substring(start, end);
        chunks.push(chunk);
        start += chunk.length - overlap;
    }
    return chunks;
}

syncSpacesKnowledge();
