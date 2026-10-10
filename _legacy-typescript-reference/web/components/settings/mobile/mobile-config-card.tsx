'use client';

import { ReactNode, useState } from 'react';
import { LucideIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileConfigCardProps {
    title: string;
    description?: string;
    icon: LucideIcon;
    iconColor?: string;
    children: ReactNode;
    className?: string;
    defaultExpanded?: boolean;
}

export function MobileConfigCard({
    title,
    description,
    icon: Icon,
    iconColor = 'text-blue-500',
    children,
    className,
    defaultExpanded = true,
}: MobileConfigCardProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div
            className={cn(
                'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden',
                className
            )}
        >
            {/* Header - Clickable to toggle */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between gap-3 p-5 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 dark:bg-slate-950 rounded-lg border border-gray-200 dark:border-slate-800">
                        <Icon className={cn('h-5 w-5', iconColor)} />
                    </div>
                    <div className="text-left">
                        <h2 className="font-bold text-lg text-gray-900 dark:text-white">{title}</h2>
                        {description && (
                            <p className="text-xs text-gray-500 dark:text-slate-500">{description}</p>
                        )}
                    </div>
                </div>
                <ChevronDown
                    className={cn(
                        'h-5 w-5 text-gray-400 transition-transform duration-300 ease-in-out',
                        isExpanded && 'rotate-180'
                    )}
                />
            </button>

            {/* Collapsible Content */}
            <div
                className={cn(
                    'grid transition-all duration-300 ease-in-out',
                    isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                )}
            >
                <div className="overflow-hidden">
                    <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-slate-800 pt-4">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
