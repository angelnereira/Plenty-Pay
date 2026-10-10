"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
    ArrowUpCircle,
    ArrowDownCircle,
    RefreshCcw,
    Trash2,
    FileText,
    Calendar,
    User
} from "lucide-react";

interface Transaction {
    id: string;
    type: "ENTRY" | "EXIT" | "ADJUST";
    quantity: number;
    reason: string | null;
    reference: string | null;
    createdAt: string;
    userId: string | null;
}

interface ProductHistoryProps {
    transactions: Transaction[];
    unitType: string;
}

export function ProductHistory({ transactions, unitType }: ProductHistoryProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (transactions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-slate-800">
                <FileText className="h-12 w-12 text-gray-300 dark:text-gray-700 mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Sin Movimientos</h3>
                <p className="text-sm text-gray-500 max-w-xs">Aún no se han registrado entradas o salidas para este producto.</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Fecha</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Tipo</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Cantidad</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Referencia / Motivo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((t) => {
                            const isEntry = t.type === "ENTRY";
                            const isExit = t.type === "EXIT";

                            return (
                                <tr key={t.id} className="border-b last:border-0 border-gray-50 dark:border-slate-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                {!mounted ? "---" : new Date(t.createdAt).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-mono">
                                                {!mounted ? "---" : new Date(t.createdAt).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-tighter",
                                            isEntry ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50" :
                                                isExit ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50" :
                                                    "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800/50"
                                        )}>
                                            {isEntry ? <ArrowUpCircle size={12} /> :
                                                isExit ? <ArrowDownCircle size={12} /> :
                                                    <RefreshCcw size={12} />}
                                            {t.type === 'ENTRY' ? 'ENTRADA' : t.type === 'EXIT' ? 'SALIDA' : 'AJUSTE'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1">
                                            <span className={cn(
                                                "text-sm font-black",
                                                isEntry ? "text-emerald-600 dark:text-emerald-400" :
                                                    isExit ? "text-rose-600 dark:text-rose-400" :
                                                        "text-gray-900 dark:text-white"
                                            )}>
                                                {isEntry ? "+" : isExit ? "-" : ""}{t.quantity}
                                            </span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{unitType}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                                {t.reason || "Sin descripción"}
                                            </p>
                                            {t.reference && (
                                                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded w-fit">
                                                    Ref: {t.reference}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
