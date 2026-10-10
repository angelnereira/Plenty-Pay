import { cn } from "@/lib/utils"

export interface TopListRow {
    label: string
    sublabel?: string
    value: string
    /** 0..1 — barra de proporción opcional */
    weight?: number
}

interface TopListProps {
    rows: TopListRow[]
    accentColor?: string
    emptyLabel?: string
}

export function TopList({
    rows,
    accentColor = "bg-violet-500",
    emptyLabel = "Sin datos en el período seleccionado",
}: TopListProps) {
    if (rows.length === 0) {
        return (
            <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                {emptyLabel}
            </div>
        )
    }
    return (
        <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {rows.map((row, i) => (
                <li key={`${row.label}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {row.label}
                            </p>
                            {row.sublabel && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {row.sublabel}
                                </p>
                            )}
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                            {row.value}
                        </span>
                    </div>
                    {typeof row.weight === "number" && (
                        <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                            <div
                                className={cn("h-full rounded-full", accentColor)}
                                style={{ width: `${Math.max(0, Math.min(1, row.weight)) * 100}%` }}
                            />
                        </div>
                    )}
                </li>
            ))}
        </ul>
    )
}
