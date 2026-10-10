"use client";

import { useState, useEffect } from "react";
import { Package, AlertTriangle, XCircle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface InventoryStatsProps {
    stats: {
        totalProducts: number;
        lowStockProducts: number;
        outOfStockProducts: number;
        totalInventoryValue: number;
    };
}

export function InventoryStats({ stats }: InventoryStatsProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const cards = [
        {
            title: "Total Productos",
            value: stats.totalProducts,
            icon: Package,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
        },
        {
            title: "Bajo Stock",
            value: stats.lowStockProducts,
            icon: AlertTriangle,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
        },
        {
            title: "Sin Stock",
            value: stats.outOfStockProducts,
            icon: XCircle,
            color: "text-red-500",
            bg: "bg-red-500/10",
            border: "border-red-500/20",
        },
        {
            title: "Valor Inventario",
            value: !mounted ? "---" : Number(stats?.totalInventoryValue || 0).toLocaleString('es-PA', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }),
            icon: DollarSign,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
        },
    ];

    return (
        <>
            {/* Mobile: single unified card */}
            <div className="md:hidden bg-white dark:bg-[#0f172a] rounded-2xl border border-gray-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                <div className="grid grid-cols-2">
                    {cards.map((card, i) => (
                        <div
                            key={card.title}
                            className={cn(
                                "flex items-center gap-2.5 px-4 py-3.5",
                                i % 2 === 0 ? "border-r border-gray-100 dark:border-slate-800/50" : "",
                                i < 2 ? "border-b border-gray-100 dark:border-slate-800/50" : "",
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                                card.bg, "border", card.border,
                            )}>
                                <card.icon className={cn("h-4 w-4", card.color)} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.12em] leading-none mb-0.5 truncate">
                                    {card.title}
                                </p>
                                <p className="text-sm font-black text-gray-900 dark:text-white tracking-tighter tabular-nums truncate">
                                    {mounted ? card.value : "---"}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Desktop: 4 individual cards */}
            <div className="hidden md:grid grid-cols-4 gap-6">
                {cards.map((card) => (
                    <div
                        key={card.title}
                        className="group relative bg-white dark:bg-[#0f172a] p-5 rounded-[32px] border border-gray-100 dark:border-slate-800/50 shadow-sm overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/10 hover:-translate-y-1.5"
                    >
                        <div className={cn(
                            "absolute -right-6 -top-6 w-32 h-32 blur-3xl opacity-0 group-hover:opacity-30 transition-opacity duration-700 rounded-full",
                            card.bg.replace('/10', '/40')
                        )} />
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-lg",
                                card.bg, "border", card.border, card.border.replace('/20', '/40')
                            )}>
                                <card.icon className={cn("h-6 w-6", card.color)} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none mb-1.5">
                                    {card.title}
                                </p>
                                <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter tabular-nums whitespace-nowrap">
                                    {mounted ? card.value : "---"}
                                </h3>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
