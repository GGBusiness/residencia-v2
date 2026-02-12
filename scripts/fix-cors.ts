
import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente locais
dotenv.config({ path: '.env.local' });

const requiredEnv = ['SPACES_KEY', 'SPACES_SECRET', 'SPACES_ENDPOINT', 'SPACES_REGION', 'SPACES_BUCKET'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
    console.error(`❌ Erro: Variáveis faltando no .env.local: ${missingEnv.join(', ')}`);
    process.exit(1);
}

const s3Client = new S3Client({
    region: process.env.SPACES_REGION,
    endpoint: process.env.SPACES_ENDPOINT,
    credentials: {
        accessKeyId: process.env.SPACES_KEY!,
        secretAccessKey: process.env.SPACES_SECRET!,
    },
});

const BUCKET = process.env.SPACES_BUCKET!;

async function configureCors() {
    console.log(`🔧 Configurando CORS para o bucket: ${BUCKET}...`);
    console.log(`📍 Endpoint: ${process.env.SPACES_ENDPOINT}`);

    try {
        const command = new PutBucketCorsCommand({
            Bucket: BUCKET,
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ['*'],
                        AllowedMethods: ['GET', 'PUT', 'HEAD', 'POST', 'DELETE'],
                        AllowedOrigins: ['*'], // Permite tudo (Vercel, Localhost, etc)
                        ExposeHeaders: ['ETag'],
                        MaxAgeSeconds: 3000
                    }
                ]
            }
        });

        await s3Client.send(command);
        console.log('✅ SUCESSO! Regras de CORS aplicadas.');
        console.log('🌍 Agora seu site na Vercel deve conseguir fazer uploads.');

    } catch (error: any) {
        console.error('❌ Falha ao configurar CORS:', error.message);
        if (error.message.includes('Access Denied')) {
            console.error('💡 Dica: Verifique se suas chaves SPACES_KEY e SPACES_SECRET têm permissão de escrita.');
        }
    }
}

configureCors();
