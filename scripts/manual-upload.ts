
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// Load env
dotenv.config({ path: '.env.local' });

// Setup S3
const s3 = new S3Client({
    region: process.env.SPACES_REGION,
    endpoint: process.env.SPACES_ENDPOINT,
    credentials: {
        accessKeyId: process.env.SPACES_KEY!,
        secretAccessKey: process.env.SPACES_SECRET!,
    },
    forcePathStyle: false
});

// Setup Supabase
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Requires SERVICE_KEY for bypass RLS if needed, or ANON
);

const BUCKET = process.env.SPACES_BUCKET!;
const UPLOAD_DIR = './upload_queue';

async function uploadFiles() {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR);
        console.log(`📁 Pasta '${UPLOAD_DIR}' criada. Coloque seus PDFs/ZIPs lá dentro!`);
        return;
    }

    const files = fs.readdirSync(UPLOAD_DIR).filter(f => f.endsWith('.pdf') || f.endsWith('.zip'));

    if (files.length === 0) {
        console.log(`⚠️ Nenhum arquivo encontrado em '${UPLOAD_DIR}'.`);
        return;
    }

    console.log(`🚀 Iniciando upload de ${files.length} arquivos via Terminal (Bypassing Browser)...`);

    for (const file of files) {
        const filePath = path.join(UPLOAD_DIR, file);
        const fileContent = fs.readFileSync(filePath);
        const contentType = mime.lookup(filePath) || 'application/octet-stream';

        // Sanitize
        const cleanName = file.toLowerCase().replace(/[^a-z0-9.]/g, '-');
        const key = `knowledge-base/${Date.now()}-${cleanName}`;

        console.log(`⬆️ Uploading: ${file} -> ${key}`);

        try {
            await s3.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: fileContent,
                ContentType: contentType
            }));

            const publicUrl = `https://${BUCKET}.${process.env.SPACES_REGION}.digitaloceanspaces.com/${key}`;

            console.log(`✅ Upload OK. Registrando no banco...`);

            // Insert into documents table directly (Simulation of Ingest)
            const { error } = await supabase.from('documents').insert({
                title: file,
                doc_type: 'manual_cli_upload',
                file_path: publicUrl,
                metadata: { source: 'cli_script' },
                year: new Date().getFullYear()
            });

            if (error) console.error(`❌ Erro banco: ${error.message}`);
            else console.log(`💾 Registrado no Banco de Dados!`);

        } catch (err: any) {
            console.error(`❌ Falha no upload: ${err.message}`);
        }
    }
}

uploadFiles();
