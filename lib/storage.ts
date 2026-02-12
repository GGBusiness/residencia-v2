import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configuração do Cliente S3 (DigitalOcean Spaces)
// Configuração do Cliente S3 (DigitalOcean Spaces)
if (!process.env.SPACES_KEY || !process.env.SPACES_SECRET) {
    console.error('❌ CRITICAL: SPACES_KEY or SPACES_SECRET is missing from environment variables!');
}

const s3Client = new S3Client({
    region: process.env.SPACES_REGION || 'nyc3',
    endpoint: process.env.SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com',
    credentials: {
        accessKeyId: process.env.SPACES_KEY || '',
        secretAccessKey: process.env.SPACES_SECRET || '',
    },
    forcePathStyle: true // Enforce "https://endpoint/bucket" (Fixes SSL/DNS issues)
});

const BUCKET = process.env.SPACES_BUCKET || 'residencia-files-prod';

export const storageService = {
    /**
     * Gera uma URL pré-assinada para UPLOAD direto do frontend.
     * @param fileName Nome do arquivo (ex: 'apostilas/cardiologia.pdf')
     * @param contentType Tipo MIME (ex: 'application/pdf')
     */
    async getUploadUrl(fileName: string, contentType: string) {
        // Sanitize filename to avoid S3 Signature mismatches (Accents, Spaces, Special Chars)
        const sanitizedParams = sanitizeFileName(fileName);
        const key = `knowledge-base/${Date.now()}-${sanitizedParams}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            ContentType: contentType,
            // ACL removida para evitar erro de CORS/Header Mismatch (Default = Private)
        });

        // URL válida por 15 minutos
        const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });

        // Retorna a URL de upload e a URL pública final
        const publicUrl = `${process.env.SPACES_ENDPOINT}/${BUCKET}/${key}`.replace(`${BUCKET}.${process.env.SPACES_REGION}.`, `${BUCKET}.`);

        // Ajuste fino para URL da DigitalOcean (as vezes o endpoint varia)
        // O padrão costuma ser https://BUCKET.REGION.digitaloceanspaces.com/KEY
        const finalPublicUrl = `https://${BUCKET}.${process.env.SPACES_REGION}.digitaloceanspaces.com/${key}`;

        return { uploadUrl: url, key, publicUrl: finalPublicUrl };
    },

    /**
     * Gera uma URL pré-assinada para DOWNLOAD (caso o arquivo seja privado)
     */
    async getDownloadUrl(key: string) {
        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: key,
        });
        return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    }
};

function sanitizeFileName(fileName: string): string {
    return fileName
        .normalize('NFD') // Decompose accents
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '-') // Replace non-alphanumeric with hyphen
        .replace(/-+/g, '-'); // Remove duplicate hyphens
}
