'use client';

import { FileText, CheckCircle, AlertCircle, Clock, Loader2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface MobileInvoiceItemProps {
    id: string;
    invoiceNumber: string | null;
    clientName?: string;
    total: number | string;
    status: string;
    createdAt: Date;
}

const statusConfig: Record<string, { icon: typeof CheckCircle; label: string; lightClass: string; darkClass: string }> = {
    CERTIFIED: {
        icon: CheckCircle,
        label: 'Emitida',
        lightClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        darkClass: 'dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    },
    EMITTED: {
        icon: CheckCircle,
        label: 'Emitida',
        lightClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        darkClass: 'dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    },
    ERROR: {
        icon: AlertCircle,
        label: 'Error',
        lightClass: 'bg-red-100 text-red-700 border-red-200',
        darkClass: 'dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
    },
    REJECTED: {
        icon: AlertCircle,
        label: 'Rechazada',
        lightClass: 'bg-red-100 text-red-700 border-red-200',
        darkClass: 'dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
    },
    PROCESSING: {
        icon: Loader2,
        label: 'Procesando',
        lightClass: 'bg-blue-100 text-blue-700 border-blue-200',
        darkClass: 'dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    },
    QUEUED: {
        icon: Clock,
        label: 'En Cola',
        lightClass: 'bg-amber-100 text-amber-700 border-amber-200',
        darkClass: 'dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    },
    DRAFT: {
        icon: Clock,
        label: 'Borrador',
        lightClass: 'bg-gray-100 text-gray-600 border-gray-200',
        darkClass: 'dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
    },
};

export function MobileInvoiceItem({
    id,
    invoiceNumber,
    clientName,
    total,
    status,
    createdAt,
}: MobileInvoiceItemProps) {
    const config = statusConfig[status] || statusConfig.DRAFT;
    const StatusIcon = config.icon;
    const isSpinning = status === 'PROCESSING';

    return (
        <Link
            href={`/dashboard/facturas/${id}`}
            className={cn(
                'flex items-center gap-3 p-3.5',
                // Light: white card with shadow | Dark: slate
                'bg-white dark:bg-white/[0.05]',
                'hover:bg-gray-50 dark:hover:bg-white/[0.05]',
                'rounded-xl border border-gray-200 dark:border-white/[0.1]',
                'hover:border-gray-300 dark:hover:border-white/[0.1]',
                'shadow-sm hover:shadow-md dark:shadow-none',
                'transition-all duration-200 active:scale-[0.99]',
                'group'
            )}
        >
            {/* Invoice Icon */}
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-white/[0.05]">
                <FileText className="h-4 w-4 text-violet-600 dark:text-slate-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {clientName || invoiceNumber || 'Sin número'}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        ${Number(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                        {invoiceNumber ? `#${invoiceNumber}` : 'Sin #'} • {format(new Date(createdAt), 'dd MMM', { locale: es })}
                    </span>

                    {/* Status Badge */}
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border',
                            config.lightClass,
                            config.darkClass
                        )}
                    >
                        <StatusIcon className={cn('h-2.5 w-2.5', isSpinning && 'animate-spin')} />
                        {config.label}
                    </span>
                </div>
            </div>

            {/* Chevron */}
            <ChevronRight className="h-4 w-4 text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300 transition-colors" />
        </Link>
    );
}

