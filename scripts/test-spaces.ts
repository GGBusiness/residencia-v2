import 'dotenv/config';
import { S3Client, ListObjectsCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('🔍 Testando Conexão com DigitalOcean Spaces...');
console.log(`🔑 Key: ${process.env.SPACES_KEY?.substring(0, 5)}...`);
console.log(`🔐 Secret: ${process.env.SPACES_SECRET?.substring(0, 5)}...`);
console.log(`📦 Bucket: ${process.env.SPACES_BUCKET}`);
console.log(`🌍 Region: ${process.env.SPACES_REGION}`);
console.log(`🔗 Endpoint: ${process.env.SPACES_ENDPOINT}`);

const client = new S3Client({
    region: process.env.SPACES_REGION || 'nyc3',
    endpoint: process.env.SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com',
    credentials: {
        accessKeyId: process.env.SPACES_KEY || '',
        secretAccessKey: process.env.SPACES_SECRET || '',
    },
    forcePathStyle: false // DigitalOcean supports virtual-hosted style
});

async function run() {
    try {
        console.log('\n1️⃣  Tentando listar Buckets (Verifica Credenciais)...');
        const buckets = await client.send(new ListBucketsCommand({}));
        console.log('✅ Conexão bem sucedida! Buckets encontrados:');
        buckets.Buckets?.forEach(b => console.log(`   - ${b.Name}`));

        console.log(`\n2️⃣  Tentando listar arquivos em '${process.env.SPACES_BUCKET}'...`);
        const objects = await client.send(new ListObjectsCommand({
            Bucket: process.env.SPACES_BUCKET
        }));
        console.log(`✅ Acesso ao Bucket OK! Encontrados ${objects.Contents?.length || 0} arquivos.`);

    } catch (error: any) {
        console.error('\n❌ ERRO DETALHADO:');
        console.error(`   Message: ${error.message}`);
        console.error(`   Code: ${error.code}`); // ex: SignatureDoesNotMatch, NoSuchBucket
        console.error(`   FullStack: ${error.stack}`);
    }
}

run();
