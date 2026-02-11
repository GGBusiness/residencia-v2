import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hover?: boolean;
    glass?: boolean;
}

export function Card({ children, className, onClick, hover = false, glass = false }: CardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                'rounded-2xl border transition-all duration-300 ease-in-out',
                // Default style
                'bg-white border-slate-100 shadow-soft',
                // Hover effect
                hover && 'cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:border-primary-200',
                // Glassmorphism effect
                glass && 'bg-white/70 backdrop-blur-xl border-white/50 shadow-lg',
                className
            )}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('px-6 py-5 border-b border-slate-50', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return <h3 className={cn('text-lg font-bold text-slate-900 tracking-tight', className)}>{children}</h3>;
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('p-6 pt-0', className)}>{children}</div>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('px-6 py-5', className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('flex items-center p-6 pt-0', className)}>{children}</div>;
}
