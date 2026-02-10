/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: [],
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
};

export default nextConfig;
