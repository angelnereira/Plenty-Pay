'use client';

import { cn } from '@/lib/utils';

interface PageWrapperProps {
    children: React.ReactNode;
    className?: string;
    /** Disable entrance animation */
    noAnimation?: boolean;
}

/**
 * Wrapper component for dashboard pages that provides:
 * - Entrance animation (fade-in by default)
 * - Consistent padding and spacing
 * - Mobile-safe bottom padding
 */
export function PageWrapper({ children, className, noAnimation = false }: PageWrapperProps) {
    return (
        <div
            className={cn(
                "w-full",
                !noAnimation && "animate-fade-in",
                className
            )}
        >
            {children}
        </div>
    );
}

/**
 * Main content wrapper with proper mobile padding
 * Use this as the main wrapper for page content
 */
export function MainContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <main
            className={cn(
                "main-content min-h-screen",
                className
            )}
        >
            {children}
        </main>
    );
}
