'use client';

import { Receipt, TrendingUp, Clock, CheckCircle, Calculator } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface MobileHeroCardProps {
    totalAmount: string;
    certifiedCount: string;
    pendingCount: string;
    /** ITBMS acumulado a pagar (string numérico, ej. "1234.56"). */
    accumulatedItbms?: string;
    usageCounter?: string;
    className?: string;
}

export function MobileHeroCard({
    totalAmount,
    certifiedCount,
    pendingCount,
    accumulatedItbms = '0',
    usageCounter = '0/5k',
    className,
}: MobileHeroCardProps) {
    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-2xl p-5 sm:p-6',
                // Light: soft blue gradient | Dark: slate gradient
                'bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800',
                'dark:from-white/[0.06] dark:backdrop-blur-2xl dark:via-white/[0.05] dark:to-white/[0.06]',
                'border border-violet-500/30 dark:border-white/[0.1]',
                'shadow-xl shadow-violet-500/20 dark:shadow-violet-500/10',
                className
            )}
        >
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 dark:opacity-5">
                <Receipt className="w-full h-full text-white" />
            </div>

            {/* Glow Effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/20 dark:bg-violet-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-300/20 dark:bg-purple-500/10 rounded-full blur-2xl" />

            {/* Content */}
            <div className="relative z-10">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-white/20 dark:bg-violet-500/20 backdrop-blur-sm">
                            <TrendingUp className="h-4 w-4 text-white dark:text-violet-400" />
                        </div>
                        <span className="text-sm font-medium text-violet-100 dark:text-slate-400">
                            Facturación Total
                        </span>
                    </div>

                    {/* Usage Counter */}
                    <div className="px-2.5 py-1 rounded-full bg-white/20 dark:bg-white/[0.05] border border-white/30 dark:border-white/[0.1] backdrop-blur-sm">
                        <span className="text-xs font-medium text-white dark:text-slate-300">
                            {usageCounter}
                        </span>
                    </div>
                </div>

                {/* Main Amount */}
                <div className="mb-2">
                    <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                        ${Number(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h2>
                </div>

                {/* Recaudación de impuestos (ITBMS) */}
                <div className="mb-5 flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5 text-violet-200 dark:text-slate-400" />
                    <span className="text-xs font-medium text-violet-100 dark:text-slate-400">Recaudación de impuestos:</span>
                    <span className="text-xs font-bold text-white">{formatCurrency(accumulatedItbms)}</span>
                </div>

                {/* Status Pills */}
                <div className="flex items-center gap-3">
                    {/* Emitidas Pill */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-400/20 dark:bg-emerald-500/10 border border-emerald-300/40 dark:border-emerald-500/20">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-200 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-100 dark:text-emerald-400">
                            Emitidas: {certifiedCount}
                        </span>
                    </div>

                    {/* En Proceso Pill */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/20 dark:bg-amber-500/10 border border-amber-300/40 dark:border-amber-500/20">
                        <Clock className="h-3.5 w-3.5 text-amber-200 dark:text-amber-400" />
                        <span className="text-xs font-semibold text-amber-100 dark:text-amber-400">
                            En Proceso: {pendingCount}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

