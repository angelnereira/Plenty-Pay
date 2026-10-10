"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, BarChart3, LineChart as LineIcon, Table as TableIcon, Hash, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { MEASURES, MEASURE_IDS } from "../model/measures"
import { DIMENSIONS, DIMENSION_IDS } from "../model/dimensions"
import type { MeasureId, DimensionId } from "../model/types/bi.types"
import { SectionCard } from "./widgets/section-card"
import { KpiCard } from "./widgets/kpi-card"
import { BILineChart } from "./widgets/line-chart"
import { DataTable } from "./widgets/data-table"
import { formatCents } from "@/lib/constants/plans"

type WidgetType = "kpi" | "line" | "table"

const WIDGET_TYPES: Array<{ id: WidgetType; label: string; icon: typeof Hash }> = [
    { id: "kpi", label: "KPI", icon: Hash },
    { id: "line", label: "Línea", icon: LineIcon },
    { id: "table", label: "Tabla", icon: TableIcon },
]

interface Props {
    /** Si viene, ofrece "Guardar como widget en este tablero". */
    targetDashboardId?: string
}

export function ExploreBuilder({ targetDashboardId }: Props) {
    const router = useRouter()
    const [type, setType] = useState<WidgetType>("table")
    const [measures, setMeasures] = useState<MeasureId[]>(["sales_total"])
    const [dimensions, setDimensions] = useState<DimensionId[]>([])
    const [title, setTitle] = useState("Mi widget")

    const [rows, setRows] = useState<Array<Record<string, unknown>>>([])
    const [running, setRunning] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const query = useMemo(() => ({
        measures,
        dimensions: dimensions.length > 0 ? dimensions : undefined,
        sortBy: dimensions.length > 0
            ? { field: measures[0] as string, direction: "desc" as const }
            : undefined,
        limit: 100,
    }), [measures, dimensions])

    const run = async () => {
        setRunning(true)
        setError(null)
        try {
            const res = await fetch("/api/bi/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(query),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
            setRows(data.rows)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
            setRows([])
        } finally {
            setRunning(false)
        }
    }

    useEffect(() => { run() // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(query)])

    const toggleMeasure = (id: MeasureId) => {
        setMeasures((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])
    }
    const toggleDimension = (id: DimensionId) => {
        setDimensions((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id])
    }

    const saveAsWidget = async () => {
        if (!targetDashboardId) return
        if (measures.length === 0) return setError("Elige al menos una medida.")
        setSaving(true)
        setError(null)
        try {
            const res = await fetch(`/api/bi/dashboards/${targetDashboardId}/widgets`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type,
                    title: title.trim() || "Sin título",
                    query,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
            router.push(`/dashboard/bi/dashboards/${targetDashboardId}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setSaving(false)
        }
    }

    const numericValue = (v: unknown): number => {
        const n = Number(v)
        return Number.isFinite(n) ? n : 0
    }
    const formatMeasure = (id: string, n: number): string => {
        const currencyMeasures: string[] = ["sales_total", "sales_subtotal", "ticket_avg", "gross_sales", "discounts"]
        if (currencyMeasures.includes(id)) return formatCents(n * 100)
        return n.toLocaleString("en-US", { maximumFractionDigits: 2 })
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Panel izquierdo — selectores */}
            <div className="lg:col-span-4 space-y-4">
                <SectionCard title="Visualización">
                    <div className="grid grid-cols-3 gap-2">
                        {WIDGET_TYPES.map((t) => {
                            const Icon = t.icon
                            const active = type === t.id
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => setType(t.id)}
                                    className={cn(
                                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                                        active
                                            ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                                            : "border-slate-200 dark:border-white/[0.1] hover:border-violet-500/40",
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="text-xs font-semibold">{t.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </SectionCard>

                <SectionCard title="Medidas" subtitle="Lo que se mide y agrega">
                    <div className="space-y-1.5">
                        {MEASURE_IDS.map((id) => {
                            const m = MEASURES[id]
                            const active = measures.includes(id)
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => toggleMeasure(id)}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                                        active
                                            ? "bg-violet-500/15 text-violet-900 dark:text-violet-100 border border-violet-500/30"
                                            : "bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-300 border border-transparent hover:border-slate-200 dark:hover:border-white/[0.08]",
                                    )}
                                >
                                    <span className="font-medium truncate">{m.label}</span>
                                    <span className="text-[10px] uppercase opacity-60">{m.unit}</span>
                                </button>
                            )
                        })}
                    </div>
                </SectionCard>

                <SectionCard title="Dimensiones" subtitle="Cómo se agrupan las filas">
                    <div className="space-y-1.5">
                        {DIMENSION_IDS.map((id) => {
                            const d = DIMENSIONS[id]
                            const active = dimensions.includes(id)
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => toggleDimension(id)}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                                        active
                                            ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 border border-emerald-500/30"
                                            : "bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-300 border border-transparent hover:border-slate-200 dark:hover:border-white/[0.08]",
                                    )}
                                >
                                    <span className="font-medium">{d.label}</span>
                                    <span className="text-[10px] uppercase opacity-60">{d.type}</span>
                                </button>
                            )
                        })}
                    </div>
                </SectionCard>
            </div>

            {/* Preview + guardar */}
            <div className="lg:col-span-8 space-y-4">
                <SectionCard
                    title="Vista previa"
                    subtitle={running ? "Ejecutando…" : `${rows.length} filas · ${measures.length} medida(s) · ${dimensions.length} dimensión(es)`}
                    action={running ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                >
                    {error && <div className="text-xs text-rose-600 dark:text-rose-400 mb-3">{error}</div>}
                    {type === "kpi" && rows.length > 0 && (
                        <KpiCard
                            label={MEASURES[measures[0]]?.label ?? measures[0]}
                            value={formatMeasure(measures[0], numericValue(rows[0]?.[measures[0]]))}
                            icon={BarChart3}
                        />
                    )}
                    {type === "line" && rows.length > 0 && (
                        <BILineChart
                            data={rows.map((r) => ({
                                label: String(r[dimensions[0] ?? "day"] ?? ""),
                                value: numericValue(r[measures[0]]),
                            }))}
                            valueFormat={
                                ["sales_total", "sales_subtotal", "ticket_avg", "gross_sales", "discounts"].includes(measures[0])
                                    ? "currency"
                                    : "count"
                            }
                        />
                    )}
                    {type === "table" && (
                        <DataTable
                            rows={rows}
                            rowKey={(_, i) => `${i}`}
                            emptyLabel="Sin filas. Ajusta medidas/dimensiones."
                            columns={[
                                ...dimensions.map((d) => ({
                                    header: DIMENSIONS[d].label,
                                    accessor: (r: Record<string, unknown>) => String(r[d] ?? ""),
                                })),
                                ...measures.map((m) => ({
                                    header: MEASURES[m].label,
                                    accessor: (r: Record<string, unknown>) => formatMeasure(m, numericValue(r[m])),
                                    align: "right" as const,
                                })),
                            ]}
                        />
                    )}
                </SectionCard>

                {targetDashboardId && (
                    <SectionCard title="Guardar como widget" subtitle="Se añade al tablero seleccionado">
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                            <label className="flex-1 space-y-1.5 block">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Título</span>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full h-10 rounded-md px-3 text-sm bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-white"
                                />
                            </label>
                            <button
                                onClick={saveAsWidget}
                                disabled={saving || measures.length === 0}
                                className="h-10 px-4 rounded-md bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-70 inline-flex items-center gap-2"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Guardar widget
                            </button>
                        </div>
                    </SectionCard>
                )}

                {!targetDashboardId && (
                    <SectionCard title="¿Quieres guardar este widget?">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Abre primero un tablero (Mis tableros → seleccionar) y haz clic en
                            "Agregar widget" — volverás aquí con el destino seleccionado.
                        </p>
                    </SectionCard>
                )}
            </div>
        </div>
    )
}
