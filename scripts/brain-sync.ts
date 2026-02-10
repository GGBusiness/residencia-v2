import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
// @ts-ignore
import pdfParse from 'pdf-parse';
import { Readable } from 'stream';

// Configurar permissão TLS para dev
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Configuração do Spaces (S3 Compatible)
const s3 = new S3Client({
    region: 'us-east-1', // DigitalOcean Spaces usa compatibilidade s3, região us-east-1 é padrão para SDK
    endpoint: process.env.SPACES_ENDPOINT,
    credentials: {
        accessKeyId: process.env.SPACES_KEY!,
        secretAccessKey: process.env.SPACES_SECRET!
    }
});

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

async function brainSync() {
    console.log('🧠 Iniciando Sincronização do Cérebro (Brain Sync)...');

    // Import dinâmico do DB e AI Service
    const { db, query } = await import('../lib/db');
    const { aiService } = await import('../lib/ai-service');

    try {
        // 1. Listar arquivos no Spaces
        console.log('☁️  Listando arquivos no DigitalOcean Spaces...');
        const command = new ListObjectsV2Command({
            Bucket: process.env.SPACES_BUCKET,
            Prefix: 'provas/' // Assumindo que salvamos na pasta provas/
        });

        const response = await s3.send(command);
        const files = response.Contents || [];
        console.log(`📂 Encontrados ${files.length} arquivos na nuvem.`);

        for (const file of files) {
            if (!file.Key?.endsWith('.pdf')) continue;

            const filename = path.basename(file.Key);
            console.log(`\n📄 Processando: ${filename}`);

            try {
                // 2. Verificar se já existe no banco
                const { rows: existing } = await query('SELECT id FROM documents WHERE title = $1', [filename]);
                if (existing.length > 0) {
                    console.log('   ⏭️  Já indexado. Pulando.');
                    continue;
                }

                // 3. Baixar arquivo
                console.log('   ⬇️  Baixando...');
                const getCommand = new GetObjectCommand({
                    Bucket: process.env.SPACES_BUCKET,
                    Key: file.Key
                });
                const fileData = await s3.send(getCommand);
                const pdfBuffer = await streamToBuffer(fileData.Body as Readable);

                // 4. Extrair Texto
                console.log('   👀 Lendo conteúdo...');
                const data = await pdfParse(pdfBuffer);
                const text = data.text;

                // Detectar metadados básicos
                const year = filename.match(/20\d{2}/)?.[0] || '2024';
                let institution = 'Outros';
                if (filename.toLowerCase().includes('enare')) institution = 'ENARE';
                else if (filename.toLowerCase().includes('usp')) institution = 'USP';

                // 5. Salvar Documento Reference
                const { rows: docParams } = await query(`
                    INSERT INTO documents (title, type, year, institution, pdf_url, processed)
                    VALUES ($1, 'PROVA', $2, $3, $4, TRUE)
                    RETURNING id
                `, [filename, parseInt(year), institution, file.Key]); // Salvando Key como URL relativa/referência

                const docId = docParams[0].id;
                console.log(`   ✅ Documento registrado (ID: ${docId})`);

                // 6. Gerar Embeddings (Chunks)
                console.log('   🧠 Gerando memórias (Embeddings)...');
                const chunks = aiService.chunkText(text);

                let chunksSaved = 0;
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    if (chunk.length < 50) continue; // Pular pedaços muito pequenos

                    const embedding = await aiService.generateEmbedding(chunk);

                    // Salvar vetor
                    await query(`
                        INSERT INTO document_embeddings (document_id, content, embedding, chunk_index)
                        VALUES ($1, $2, $3, $4)
                    `, [docId, chunk, JSON.stringify(embedding), i]);

                    chunksSaved++;
                    process.stdout.write('.'); // Progresso visual
                }
                console.log(`\n   ✨ ${chunksSaved} vetores salvos.`);

                // TODO: Se quiser extrair questões, chamaria a função de extração aqui.
            } catch (fileError) {
                console.error(`\n   ❌ Erro ao processar ${filename}:`, fileError);
                // Continue to next file
            }
        }

        console.log('\n🎉 Sincronização Finalizada com Sucesso!');

    } catch (error) {
        console.error('❌ Erro fatal no Brain Sync:', error);
    } finally {
        process.exit(0);
    }
}

brainSync();
