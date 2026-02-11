
import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={`bg-white rounded-xl shadow-xl w-full ${sizeClasses[size]} overflow-hidden animate-in zoom-in-95 duration-200`}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-4">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    variant?: 'danger' | 'primary';
    isLoading?: boolean;
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    showCancel = true,
    variant = 'primary',
    isLoading = false
}: ConfirmationModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    {showCancel && (
                        <Button variant="outline" onClick={onClose} disabled={isLoading}>
                            {cancelText}
                        </Button>
                    )}
                    <Button
                        onClick={onConfirm || onClose}
                        variant={variant === 'danger' ? 'danger' : 'primary'}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Processando...' : confirmText}
                    </Button>
                </>
            }
        >
            <p className="text-gray-600">
                {message}
            </p>
        </Modal>
    );
}
