import { cn } from "@/lib/utils"

interface CohortRow {
    cohort: string
    cohortSize: number
    retention: number[]
}

interface Props {
    cohorts: CohortRow[]
    horizon: number
}

export function CohortHeatmap({ cohorts, horizon }: Props) {
    if (cohorts.length === 0) {
        return (
            <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">
                Aún no hay suficiente histórico de clientes para construir cohortes.
            </div>
        )
    }
    return (
        <div className="overflow-x-auto -mx-5">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10">
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cohorte</th>
                        <th className="px-3 py-2 text-right font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Clientes</th>
                        {Array.from({ length: horizon }, (_, i) => (
                            <th key={i} className="px-2 py-2 text-center font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">M+{i}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {cohorts.map((c) => (
                        <tr key={c.cohort} className="border-b border-slate-100 dark:border-white/[0.06] last:border-0">
                            <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white tabular-nums">{c.cohort}</td>
                            <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400 tabular-nums">{c.cohortSize}</td>
                            {c.retention.map((retained, i) => {
                                if (i === 0) return (
                                    <td key={i} className="px-2 py-2 text-center bg-violet-600 text-white font-bold tabular-nums">100%</td>
                                )
                                const pct = c.cohortSize > 0 ? (retained / c.cohortSize) * 100 : 0
                                return (
                                    <td
                                        key={i}
                                        className={cn(
                                            "px-2 py-2 text-center text-slate-700 dark:text-slate-300 tabular-nums",
                                            shadeFor(pct),
                                        )}
                                        title={`${retained} de ${c.cohortSize}`}
                                    >
                                        {retained > 0 ? `${Math.round(pct)}%` : "—"}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function shadeFor(pct: number): string {
    if (pct >= 60) return "bg-violet-500/40 text-white"
    if (pct >= 40) return "bg-violet-500/25"
    if (pct >= 20) return "bg-violet-500/15"
    if (pct > 0)   return "bg-violet-500/5"
    return ""
}
