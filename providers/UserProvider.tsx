'use client';

import React, { createContext, useContext } from 'react';
import { useUser as useUserHook } from '@/hooks/useUser';

const UserContext = createContext<ReturnType<typeof useUserHook> | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const userData = useUserHook();

    return (
        <UserContext.Provider value={userData}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        // Fallback to hook if provider is missing (useful for small tests, 
        // but try to use provider for performance)
        return useUserHook();
    }
    return context;
}
