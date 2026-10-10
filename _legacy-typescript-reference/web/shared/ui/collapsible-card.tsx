'use client';

import { ReactNode, useState } from 'react';
import { LucideIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleCardProps {
    title: string;
    description?: string;
    icon: LucideIcon;
    iconColor?: string;
    children: ReactNode;
    className?: string;
    defaultExpanded?: boolean;
}

export function CollapsibleCard({
    title,
    description,
    icon: Icon,
    iconColor = 'text-primary',
    children,
    className,
    defaultExpanded = true,
}: CollapsibleCardProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div
            className={cn(
                'bg-card border rounded-lg shadow-sm overflow-hidden',
                className
            )}
        >
            {/* Header - Clickable to toggle */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between gap-4 p-6 hover:bg-muted/50 transition-colors text-left"
            >
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-muted rounded-lg">
                        <Icon className={cn('h-5 w-5', iconColor)} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
                        {description && (
                            <p className="text-sm text-muted-foreground">{description}</p>
                        )}
                    </div>
                </div>
                <ChevronDown
                    className={cn(
                        'h-5 w-5 text-muted-foreground transition-transform duration-300 ease-in-out flex-shrink-0',
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
                    <div className="px-6 pb-6 border-t">
                        <div className="pt-6">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
