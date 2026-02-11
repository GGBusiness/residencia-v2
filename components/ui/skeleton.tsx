import React from 'react';

export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={`animate-shimmer bg-gray-200 rounded ${className}`}
        />
    );
}

export function CardSkeleton() {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex gap-2 mt-4">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
            </div>
        </div>
    );
}
