"use client";

import { AlertCircle, CheckCircle2, CloudFog, XCircle } from "lucide-react";

export function QuickStatsWidget() {
    // TODO: Connect with real data
    // For now, these are placeholders based on typical "today's metrics"
    const stats = {
        onTime: 4,
        late: 1,
        absent: 0,
        pending: 3
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="mb-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-1">
                    Resumen del Día
                </h3>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <QuickStatItem
                    label="A Tiempo"
                    value={stats.onTime}
                    icon={CheckCircle2}
                    color="text-emerald-600 dark:text-emerald-400"
                    bgColor="bg-emerald-50 dark:bg-emerald-500/10"
                />
                <QuickStatItem
                    label="Retardos"
                    value={stats.late}
                    icon={AlertCircle}
                    color="text-amber-600 dark:text-amber-400"
                    bgColor="bg-amber-50 dark:bg-amber-500/10"
                />
                <QuickStatItem
                    label="Ausencias"
                    value={stats.absent}
                    icon={XCircle}
                    color="text-red-600 dark:text-red-400"
                    bgColor="bg-red-50 dark:bg-red-500/10"
                />
                <QuickStatItem
                    label="Pendientes"
                    value={stats.pending}
                    icon={CloudFog}
                    color="text-slate-600 dark:text-slate-400"
                    bgColor="bg-slate-50 dark:bg-slate-500/10"
                />
            </div>
        </div>
    );
}

function QuickStatItem({ label, value, icon: Icon, color, bgColor }: any) {
    return (
        <div className={`flex flex-col items-center justify-center p-4 rounded-2xl ${bgColor} transition-transform hover:scale-105`}>
            <div className={`mb-2 ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
            <span className={`text-2xl font-black ${color}`}>
                {value}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {label}
            </span>
        </div>
    );
}
