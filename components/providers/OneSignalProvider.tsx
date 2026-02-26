'use client';

import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { useUser } from '@/hooks/useUser';

export default function OneSignalProvider({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const userId = user?.id;
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        const initOneSignal = async () => {
            if (initialized) return;

            try {
                await OneSignal.init({
                    appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '',
                    allowLocalhostAsSecureOrigin: true,
                });
                setInitialized(true);
            } catch (error) {
                console.error('OneSignal initialization error:', error);
            }
        };

        if (typeof window !== 'undefined') {
            initOneSignal();
        }
    }, [initialized]);

    // Bind User ID to OneSignal when logged in
    useEffect(() => {
        if (initialized && userId) {
            try {
                OneSignal.login(userId);
            } catch (error) {
                console.error('OneSignal exact login error:', error);
            }
        } else if (initialized && !userId) {
            try {
                OneSignal.logout();
            } catch (e) { }
        }
    }, [initialized, userId]);

    return <>{children}</>;
}
