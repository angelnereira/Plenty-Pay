'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionButtonProps {
    label: string;
    description?: string;
    icon: LucideIcon;
    variant?: 'primary' | 'secondary';
    color?: 'violet' | 'emerald' | 'blue' | 'amber' | 'rose';
    onClick?: () => void;
    disabled?: boolean;
}

const colorStyles = {
    violet: {
        gradient: 'from-violet-600 to-violet-700',
        hoverGradient: 'hover:from-violet-500 hover:to-violet-600',
        shadow: 'shadow-violet-500/25',
        ring: 'focus:ring-violet-500',
        iconBg: 'bg-violet-100 dark:bg-violet-500/20',
        iconColor: 'text-violet-600 dark:text-violet-400',
        border: 'border-violet-200/60 dark:border-violet-500/20',
        hoverBorder: 'hover:border-violet-300 dark:hover:border-violet-500/30',
    },
    emerald: {
        gradient: 'from-emerald-600 to-emerald-700',
        hoverGradient: 'hover:from-emerald-500 hover:to-emerald-600',
        shadow: 'shadow-emerald-500/25',
        ring: 'focus:ring-emerald-500',
        iconBg: 'bg-emerald-100 dark:bg-emerald-500/20',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        border: 'border-emerald-200/60 dark:border-emerald-500/20',
        hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-500/30',
    },
    blue: {
        gradient: 'from-blue-600 to-blue-700',
        hoverGradient: 'hover:from-blue-500 hover:to-blue-600',
        shadow: 'shadow-blue-500/25',
        ring: 'focus:ring-blue-500',
        iconBg: 'bg-blue-100 dark:bg-blue-500/20',
        iconColor: 'text-blue-600 dark:text-blue-400',
        border: 'border-blue-200/60 dark:border-blue-500/20',
        hoverBorder: 'hover:border-blue-300 dark:hover:border-blue-500/30',
    },
    amber: {
        gradient: 'from-amber-600 to-amber-700',
        hoverGradient: 'hover:from-amber-500 hover:to-amber-600',
        shadow: 'shadow-amber-500/25',
        ring: 'focus:ring-amber-500',
        iconBg: 'bg-amber-100 dark:bg-amber-500/20',
        iconColor: 'text-amber-600 dark:text-amber-400',
        border: 'border-amber-200/60 dark:border-amber-500/20',
        hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-500/30',
    },
    rose: {
        gradient: 'from-rose-600 to-rose-700',
        hoverGradient: 'hover:from-rose-500 hover:to-rose-600',
        shadow: 'shadow-rose-500/25',
        ring: 'focus:ring-rose-500',
        iconBg: 'bg-rose-100 dark:bg-rose-500/20',
        iconColor: 'text-rose-600 dark:text-rose-400',
        border: 'border-rose-200/60 dark:border-rose-500/20',
        hoverBorder: 'hover:border-rose-300 dark:hover:border-rose-500/30',
    },
};

export function QuickActionButton({
    label,
    description,
    icon: Icon,
    variant = 'secondary',
    color = 'violet',
    onClick,
    disabled = false,
}: QuickActionButtonProps) {
    const isPrimary = variant === 'primary';
    const colors = colorStyles[color];

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'group relative flex flex-col items-center justify-center gap-3 p-5 rounded-2xl',
                'min-h-[120px] w-full',
                'transition-all duration-300 ease-out',
                'active:scale-[0.97]',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                isPrimary
                    ? [
                        `bg-gradient-to-br ${colors.gradient}`,
                        colors.hoverGradient,
                        'text-white',
                        `shadow-lg ${colors.shadow}`,
                        'hover:shadow-xl hover:-translate-y-0.5',
                        colors.ring,
                        'focus:ring-offset-gray-50 dark:focus:ring-offset-slate-950',
                    ]
                    : [
                        'bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl',
                        'hover:bg-gray-50/80 dark:hover:bg-white/[0.08]',
                        `border ${colors.border}`,
                        colors.hoverBorder,
                        'text-gray-700 dark:text-slate-200',
                        'shadow-sm hover:shadow-md hover:-translate-y-0.5',
                        colors.ring,
                        'focus:ring-offset-gray-50 dark:focus:ring-offset-slate-950',
                    ],
                disabled && 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-sm'
            )}
        >
            {/* Icon Container */}
            <div
                className={cn(
                    'relative p-3 rounded-xl transition-transform duration-300 group-hover:scale-110',
                    isPrimary
                        ? 'bg-white/20 backdrop-blur-sm'
                        : colors.iconBg
                )}
            >
                <Icon
                    className={cn(
                        'h-6 w-6',
                        isPrimary ? 'text-white' : colors.iconColor
                    )}
                    strokeWidth={2}
                />
            </div>

            {/* Text Content */}
            <div className="text-center space-y-0.5">
                <span
                    className={cn(
                        'text-sm font-bold block',
                        isPrimary ? 'text-white' : 'text-gray-800 dark:text-slate-200'
                    )}
                >
                    {label}
                </span>
                {description && (
                    <span
                        className={cn(
                            'text-[10px] font-medium block',
                            isPrimary ? 'text-white/70' : 'text-gray-500 dark:text-slate-400'
                        )}
                    >
                        {description}
                    </span>
                )}
            </div>
        </button>
    );
}
