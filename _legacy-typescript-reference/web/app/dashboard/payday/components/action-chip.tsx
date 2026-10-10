'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface ActionChipProps {
    icon: LucideIcon;
    label: string;
    href?: string;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'dark';
    className?: string;
}

export function ActionChip({ icon: Icon, label, href, onClick, variant = 'secondary', className: extraClass = '' }: ActionChipProps) {
    const baseClasses = `flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all active:scale-95 shadow-sm ${extraClass}`;

    const variantClasses = {
        primary: "bg-violet-600 text-white hover:bg-violet-700 shadow-violet-500/20",
        secondary: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20",
        dark: "bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700"
    };

    const className = `${baseClasses} ${variantClasses[variant]}`;

    if (href) {
        return (
            <Link href={href} className={className}>
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
            </Link>
        );
    }

    return (
        <button onClick={onClick} className={className}>
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
        </button>
    );
}
