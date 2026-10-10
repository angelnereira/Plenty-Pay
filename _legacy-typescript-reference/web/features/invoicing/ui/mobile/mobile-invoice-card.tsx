'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import {
    MoreVertical,
    Eye,
    Download,
    Mail,
    XCircle,
    CheckCircle,
    Clock,
    AlertCircle,
    Loader2,
    FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceActionsSheet } from './invoice-actions-sheet';

interface MobileInvoiceCardProps {
    id: string;
    folio: string;
    clientName: string;
    clientRuc: string;
    total: number;
    status: string;
    documentType?: string;
    createdAt: Date;
    currency?: string;
    cufe?: string;
    /** Optional callback for invoice list refresh after operations */
    onSuccess?: () => void;
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
    APPROVED: {
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
    CANCELLED: {
        icon: XCircle,
        label: 'Anulada',
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
        icon: FileText,
        label: 'Borrador',
        lightClass: 'bg-gray-100 text-gray-600 border-gray-200',
        darkClass: 'dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20',
    },
};

export function MobileInvoiceCard({
    id,
    folio,
    clientName,
    clientRuc,
    total,
    status,
    documentType,
    createdAt,
    currency = 'PAB',
    cufe,
    onSuccess,
}: MobileInvoiceCardProps) {
    const router = useRouter();
    const [showActions, setShowActions] = useState(false);

    const config = statusConfig[status] || statusConfig.DRAFT;
    const StatusIcon = config.icon;
    const isSpinning = status === 'PROCESSING';

    const handleCardClick = () => {
        router.push(`/dashboard/facturas/${id}`);
    };

    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowActions(true);
    };

    const formattedDate = format(new Date(createdAt), 'dd MMM yyyy', { locale: es });

    return (
        <>
            <div
                onClick={handleCardClick}
                className={cn(
                    'bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4',
                    'shadow-sm hover:shadow-md dark:shadow-none',
                    'active:bg-gray-50 dark:active:bg-slate-800 transition-colors cursor-pointer'
                )}
            >
                {/* Top Row: Client and Amount */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">
                            {clientName}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-500">RUC: {clientRuc}</p>
                    </div>
                    <p className="font-bold text-lg text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                {/* Bottom Row: Details, Status, and Menu */}
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <p className="text-xs text-gray-500 dark:text-slate-500 flex items-center gap-1.5">
                            {documentType === 'NOTA_CREDITO' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">NC</span>
                            )}
                            {documentType === 'NOTA_DEBITO' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">ND</span>
                            )}
                            Folio: #{folio} • {formattedDate}
                        </p>
                        {/* Status Badge */}
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border w-fit',
                                config.lightClass,
                                config.darkClass
                            )}
                        >
                            <StatusIcon className={cn('h-3 w-3', isSpinning && 'animate-spin')} />
                            {config.label}
                        </span>
                    </div>

                    {/* Actions Menu Button */}
                    <button
                        onClick={handleMenuClick}
                        className="p-2 -mr-2 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white rounded-full"
                    >
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Actions Bottom Sheet */}
            <InvoiceActionsSheet
                isOpen={showActions}
                onClose={() => setShowActions(false)}
                invoiceId={id}
                folio={folio}
                status={status}
                cufe={cufe}
                onSuccess={onSuccess}
            />
        </>
    );
}
