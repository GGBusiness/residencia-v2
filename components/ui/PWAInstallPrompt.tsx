'use client';

import { useState, useEffect } from 'react';
import { Share, Download, X } from 'lucide-react';

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Detect if the app is already installed
        const isStandaloneConfig = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone
            || document.referrer.includes('android-app://');

        setIsStandalone(isStandaloneConfig);

        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const iosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(iosDevice);

        // Event listener for Android / Chrome install prompt
        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Show custom install prompt
            // Optional: You could check a localStorage flag to not annoy the user endlessly
            const hasDismissed = localStorage.getItem('dismissed_pwa_prompt');
            if (!hasDismissed && !isStandaloneConfig) {
                setShowPrompt(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // For iOS, there is no automatic event. We just check if it's iOS and not standalone.
        if (iosDevice && !isStandaloneConfig) {
            const hasDismissed = localStorage.getItem('dismissed_pwa_prompt');
            if (!hasDismissed) {
                // Delay showing prompt so it's not aggressive on first load
                setTimeout(() => setShowPrompt(true), 3000);
            }
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            // Se for iOS, a gente só ensina o cara no popup
            return;
        }

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        // Save to not annoy again for a while
        localStorage.setItem('dismissed_pwa_prompt', 'true');
    };

    if (isStandalone || !showPrompt) {
        return null;
    }

    return (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-50 animate-slide-up">
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Ignorar"
            >
                <X className="w-5 h-5" />
            </button>

            <div className="flex gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-100">
                    <span className="text-white font-bold text-xl">R</span>
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-slate-900 leading-tight">Adicionar à Tela Inicial</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-3">
                        Instale o app Residência para acesso rápido e melhor experiência de simulados.
                    </p>

                    {isIOS ? (
                        <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-600 border border-slate-100 font-medium">
                            No painel inferior do Safari, toque em <Share className="w-3.5 h-3.5 inline text-blue-500 mx-1" /> e depois selecione <strong className="text-slate-900">Adicionar à Tela de Início</strong>.
                        </div>
                    ) : (
                        <button
                            onClick={handleInstallClick}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold py-2.5 px-4 rounded-xl w-full transition-colors flex items-center justify-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Instalar Aplicativo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
