"use client"

import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { PERIOD_OPTIONS, buildPeriodHref, type PeriodKey } from "../lib/period"

/**
 * Filtro de período compartido entre los dashboards BI. Server-friendly:
 * navega a la misma ruta cambiando ?period=. La página re-renderiza con
 * los nuevos rangos en SSR.
 */
export function PeriodFilter() {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const current = (searchParams.get("period") as PeriodKey | null) ?? "mtd"

    return (
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-full border border-slate-200 dark:border-white/[0.08]">
            {PERIOD_OPTIONS.map((opt) => {
                const active = current === opt.key
                return (
                    <Link
                        key={opt.key}
                        href={buildPeriodHref(pathname, opt.key)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                            active
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                        )}
                    >
                        {opt.label}
                    </Link>
                )
            })}
        </div>
    )
}
