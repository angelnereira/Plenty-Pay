'use client';

import { cn } from "@/lib/utils";
import { CheckCircle, Clock, FileText, AlertCircle, RefreshCw, Layers, XCircle } from "lucide-react";

export type FilterType = 'all' | 'certified' | 'draft' | 'processing' | 'error' | 'recent' | 'canceled';

interface InvoiceFiltersProps {
    stats: {
        total: number;
        emitted: number;
        draft: number;
        processing: number;
        error: number;
        canceled: number;
    };
    activeFilter: FilterType;
    onFilterChange: (filter: FilterType) => void;
}

export function InvoiceFilters({ stats, activeFilter, onFilterChange }: InvoiceFiltersProps) {
    const filters = [
        { id: 'all', label: 'Todas', count: stats.total, icon: Layers, activeClass: 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 shadow-sm' },
        { id: 'certified', label: 'Emitidas', count: stats.emitted, icon: CheckCircle, activeClass: 'bg-emerald-700 text-white border-emerald-700 shadow-sm' },
        { id: 'processing', label: 'En Proceso', count: stats.processing, icon: Clock, activeClass: 'bg-blue-700 text-white border-blue-700 shadow-sm' },
        { id: 'draft', label: 'Borradores', count: stats.draft, icon: FileText, activeClass: 'bg-amber-600 text-white border-amber-600 shadow-sm' },
        { id: 'error', label: 'Errores', count: stats.error, icon: AlertCircle, activeClass: 'bg-rose-700 text-white border-rose-700 shadow-sm' },
        { id: 'canceled', label: 'Canceladas', count: stats.canceled, icon: XCircle, activeClass: 'bg-red-700 text-white border-red-700 shadow-sm' },
        { id: 'recent', label: 'Recientes', count: null, icon: RefreshCw, activeClass: 'bg-indigo-700 text-white border-indigo-700 shadow-sm' },
    ] as const;

    return (
        <div className="flex overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 gap-1.5 md:flex-wrap hide-scrollbar">
            {filters.map((filter) => {
                const isActive = activeFilter === filter.id;
                const Icon = filter.icon;

                return (
                    <button
                        key={filter.id}
                        onClick={() => onFilterChange(filter.id as FilterType)}
                        className={cn(
                            "group flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all duration-300 whitespace-nowrap border",
                            isActive
                                ? cn("transform scale-105", filter.activeClass)
                                : filter.id === 'error' && (filter.count ?? 0) > 0
                                    ? "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        )}
                    >
                        <Icon size={12} className={cn("transition-transform duration-300 shrink-0", isActive ? "scale-110" : "group-hover:scale-110")} />
                        <span className="text-[10px] font-black uppercase tracking-wide">{filter.label}</span>
                        {filter.count !== null && (
                            <span className={cn(
                                "text-[9px] px-1 rounded font-bold transition-colors",
                                isActive
                                    ? "bg-white/20 text-white"
                                    : filter.id === 'error' && filter.count > 0
                                        ? "bg-rose-200 dark:bg-rose-800/50 text-rose-800 dark:text-rose-300"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            )}>
                                {filter.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
