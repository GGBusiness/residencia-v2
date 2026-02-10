import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
    themeColor: '#7c3aed',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export const metadata: Metadata = {
    title: 'Residência Médica - Preparação Inteligente',
    description: 'Prepare-se para a residência médica com IA e conteúdo personalizado',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'ResidênciaAI',
    },
    formatDetection: {
        telephone: false,
    },
};

import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR">
            <body className={inter.className}>
                {children}
                <ServiceWorkerRegister />
            </body>
        </html>
    );
}
