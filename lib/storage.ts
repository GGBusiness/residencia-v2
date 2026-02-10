import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configuração do Cliente S3 (DigitalOcean Spaces)
const s3Client = new S3Client({
    region: process.env.SPACES_REGION || 'nyc3',
    endpoint: process.env.SPACES_ENDPOINT || 'https://nyc3.digitaloceanspaces.com',
    credentials: {
        accessKeyId: process.env.SPACES_KEY || '',
        secretAccessKey: process.env.SPACES_SECRET || '',
    },
});

const BUCKET_NAME = process.env.SPACES_BUCKET || 'residencia-files-prod';

export const storageService = {
    /**
     * Upload de arquivo para o Spaces
     */
    async uploadFile(file: File | Buffer, path: string, contentType: string) {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: path,
            Body: file,
            // ACL: 'public-read', // Removido temporariamente para evitar erro de permissão (Access Denied)
            ContentType: contentType,
        });

        try {
            await s3Client.send(command);
            // Retorna a URL pública
            return `${process.env.SPACES_ENDPOINT}/${BUCKET_NAME}/${path}`;
        } catch (error) {
            console.error('Error uploading to Spaces:', error);
            throw error;
        }
    },

    /**
     * Gera URL assinada para upload direto do frontend (mais seguro/performático)
     */
    async getPresignedUploadUrl(path: string, contentType: string) {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: path,
            ContentType: contentType,
            ACL: 'public-read',
        });

        try {
            const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
            return url;
        } catch (error) {
            console.error('Error getting presigned URL:', error);
            throw error;
        }
    },

    /**
     * Retorna a URL pública de um arquivo
     */
    getPublicUrl(path: string) {
        // Se a URL já for completa, retorna ela
        if (path.startsWith('http')) return path;

        // Remove burning slashes if present
        const cleanPath = path.startsWith('/') ? path.slice(1) : path;
        return `https://${BUCKET_NAME}.${process.env.SPACES_REGION}.digitaloceanspaces.com/${cleanPath}`;
    }
};
