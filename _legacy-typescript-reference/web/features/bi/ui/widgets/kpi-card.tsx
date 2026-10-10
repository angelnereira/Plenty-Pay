import { cn } from "@/lib/utils"
import { TrendingDown, TrendingUp, Minus, type LucideIcon } from "lucide-react"

interface KpiCardProps {
    label: string
    value: string
    delta?: number // -1 → 1 ó más; ej. 0.124 = +12.4%
    deltaLabel?: string
    icon?: LucideIcon
    accentColor?: string
}

export function KpiCard({
    label,
    value,
    delta,
    deltaLabel,
    icon: Icon,
    accentColor = "text-violet-600 dark:text-violet-400",
}: KpiCardProps) {
    const hasDelta = typeof delta === "number" && Number.isFinite(delta)
    const positive = hasDelta && delta > 0
    const negative = hasDelta && delta < 0
    const TrendIcon = positive ? TrendingUp : negative ? TrendingDown : Minus
    const trendColor = positive
        ? "text-emerald-600 dark:text-emerald-400"
        : negative
        ? "text-rose-600 dark:text-rose-400"
        : "text-slate-500 dark:text-slate-400"

    return (
        <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {label}
                </span>
                {Icon && <Icon className={cn("h-4 w-4", accentColor)} />}
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                {value}
            </p>
            {hasDelta && (
                <div className={cn("flex items-center gap-1 mt-2 text-xs font-semibold", trendColor)}>
                    <TrendIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    <span className="tabular-nums">
                        {positive ? "+" : ""}
                        {(delta * 100).toFixed(1)}%
                    </span>
                    {deltaLabel && <span className="text-slate-500 dark:text-slate-400 font-normal">{deltaLabel}</span>}
                </div>
            )}
        </div>
    )
}
