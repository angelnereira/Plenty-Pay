"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Trash2, Loader2, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { SectionCard } from "./widgets/section-card"
import { KpiCard } from "./widgets/kpi-card"
import { BILineChart } from "./widgets/line-chart"
import { DataTable } from "./widgets/data-table"
import { formatCents } from "@/lib/constants/plans"

interface WidgetSpec {
    id: string
    type: string
    title: string
    query: Record<string, unknown>
}

interface Props {
    dashboardId: string
    widgets: WidgetSpec[]
}

/**
 * Cliente que renderiza widgets custom de un dashboard de BI Pro.
 *
 * Cada widget ejecuta su propia query contra /api/bi/query y se
 * renderiza según `type` (kpi / line / bar / pie / table).
 *
 * Permite eliminar widgets inline. La creación se hace desde
 * /dashboard/bi/explore (builder dedicado).
 */
export function CustomDashboardClient({ dashboardId, widgets }: Props) {
    const router = useRouter()
    const [results, setResults] = useState<Record<string, { rows: Array<Record<string, unknown>>; loading: boolean; error?: string }>>({})
    const [removing, setRemoving] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function run() {
            for (const w of widgets) {
                if (results[w.id]) continue
                setResults((prev) => ({ ...prev, [w.id]: { rows: [], loading: true } }))
                try {
                    const res = await fetch("/api/bi/query", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(w.query),
                    })
                    const data = await res.json()
                    if (cancelled) return
                    if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
                    setResults((prev) => ({ ...prev, [w.id]: { rows: data.rows, loading: false } }))
                } catch (err) {
                    if (cancelled) return
                    setResults((prev) => ({
                        ...prev,
                        [w.id]: { rows: [], loading: false, error: err instanceof Error ? err.message : "Error" },
                    }))
                }
            }
        }
        run()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [widgets])

    const remove = async (widgetId: string) => {
        if (!confirm("¿Eliminar widget?")) return
        setRemoving(widgetId)
        try {
            await fetch(`/api/bi/dashboards/${dashboardId}/widgets/${widgetId}`, { method: "DELETE" })
            router.refresh()
        } finally {
            setRemoving(null)
        }
    }

    if (widgets.length === 0) {
        return (
            <SectionCard title="Tablero vacío">
                <div className="text-center py-10">
                    <BarChart3 className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Agrega tu primer widget desde el explorador.
                    </p>
                    <Link
                        href={`/dashboard/bi/explore?dashboardId=${dashboardId}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500"
                    >
                        <Plus className="h-4 w-4" />
                        Agregar widget
                    </Link>
                </div>
            </SectionCard>
        )
    }

    return (
        <>
            <div className="flex items-center justify-end gap-2">
                <Link
                    href={`/dashboard/bi/explore?dashboardId=${dashboardId}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-500"
                >
                    <Plus className="h-4 w-4" />
                    Agregar widget
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {widgets.map((w) => {
                    const r = results[w.id]
                    return (
                        <SectionCard
                            key={w.id}
                            title={w.title}
                            action={
                                <button
                                    onClick={() => remove(w.id)}
                                    disabled={removing === w.id}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-md transition-colors"
                                    aria-label="Eliminar"
                                >
                                    {removing === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                            }
                            className={w.type === "kpi" ? "" : "md:col-span-2 lg:col-span-3"}
                        >
                            {!r || r.loading ? (
                                <div className="py-10 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Cargando…
                                </div>
                            ) : r.error ? (
                                <div className="py-6 text-center text-xs text-rose-600 dark:text-rose-400">
                                    {r.error}
                                </div>
                            ) : (
                                <WidgetRenderer type={w.type} rows={r.rows} query={w.query} />
                            )}
                        </SectionCard>
                    )
                })}
            </div>
        </>
    )
}

function WidgetRenderer({
    type,
    rows,
    query,
}: {
    type: string
    rows: Array<Record<string, unknown>>
    query: Record<string, unknown>
}) {
    const measures = (query.measures as string[] | undefined) ?? []
    const dimensions = (query.dimensions as string[] | undefined) ?? []
    const firstMeasure = measures[0]

    const numericValue = (v: unknown): number => {
        const n = Number(v)
        return Number.isFinite(n) ? n : 0
    }
    const formatMeasure = (id: string, n: number): string => {
        const currencyMeasures = ["sales_total", "sales_subtotal", "ticket_avg", "gross_sales", "discounts"]
        if (currencyMeasures.includes(id)) return formatCents(n * 100)
        return n.toLocaleString("en-US", { maximumFractionDigits: 2 })
    }

    if (type === "kpi") {
        const value = numericValue(rows[0]?.[firstMeasure])
        return (
            <KpiCard label={firstMeasure} value={formatMeasure(firstMeasure, value)} />
        )
    }
    if (type === "line") {
        const dim = dimensions[0] ?? "day"
        const data = rows.map((r) => ({
            label: String(r[dim] ?? ""),
            value: numericValue(r[firstMeasure]),
        }))
        const fmt: "currency" | "count" =
            ["sales_total", "sales_subtotal", "ticket_avg", "gross_sales", "discounts"].includes(firstMeasure)
                ? "currency"
                : "count"
        return data.length > 0
            ? <BILineChart data={data} valueFormat={fmt} />
            : <EmptyChart />
    }
    if (type === "table") {
        return (
            <DataTable
                rows={rows}
                rowKey={(_, i) => `${i}`}
                columns={[
                    ...dimensions.map((d) => ({
                        header: d,
                        accessor: (r: Record<string, unknown>) => String(r[d] ?? ""),
                    })),
                    ...measures.map((m) => ({
                        header: m,
                        accessor: (r: Record<string, unknown>) => formatMeasure(m, numericValue(r[m])),
                        align: "right" as const,
                    })),
                ]}
            />
        )
    }
    // bar / pie — fallback simple a tabla por ahora
    return <EmptyChart label="Tipo de visualización en desarrollo. Cambia a 'tabla' o 'línea'." />
}

function EmptyChart({ label = "Sin datos" }: { label?: string }) {
    return (
        <div className="py-10 text-center text-xs text-slate-400">{label}</div>
    )
}
