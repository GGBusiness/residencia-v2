'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    addToast: (message: string, type: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType, duration = 3000) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, message, type, duration }]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }

    // Helper methods for cleaner API
    return {
        toast: context.addToast,
        success: (message: string, duration?: number) => context.addToast(message, 'success', duration),
        error: (message: string, duration?: number) => context.addToast(message, 'error', duration),
        warning: (message: string, duration?: number) => context.addToast(message, 'warning', duration),
        info: (message: string, duration?: number) => context.addToast(message, 'info', duration),
        remove: context.removeToast
    };
}

// Internal Container Component
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
                        pointer-events-auto
                        flex items-center gap-3 p-4 rounded-lg shadow-lg border border-opacity-20
                        transform transition-all duration-300 ease-in-out animate-in slide-in-from-right-full
                        ${toast.type === 'success' ? 'bg-white border-green-200 text-gray-800' : ''}
                        ${toast.type === 'error' ? 'bg-white border-red-200 text-gray-800' : ''}
                        ${toast.type === 'warning' ? 'bg-white border-orange-200 text-gray-800' : ''}
                        ${toast.type === 'info' ? 'bg-white border-blue-200 text-gray-800' : ''}
                    `}
                    role="alert"
                >
                    <div className="flex-shrink-0">
                        {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                        {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-orange-500" />}
                        {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
                    </div>
                    <p className="flex-1 text-sm font-medium">{toast.message}</p>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Progress bar for auto-dismiss */}
                    <div className="absolute bottom-0 left-0 h-1 bg-current opacity-10 w-full animate-[shrink_linear_forwards]" style={{ animationDuration: `${toast.duration}ms` }} />
                </div>
            ))}
        </div>
    );
}
