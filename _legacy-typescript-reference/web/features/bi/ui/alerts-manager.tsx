"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MEASURE_IDS } from "@/features/bi"

type Op = "lt" | "lte" | "gt" | "gte" | "eq"
type Period = "today" | "7d" | "30d"

interface AlertItem {
    id: string
    name: string
    isActive: boolean
    config: { metric: string; op: Op; value: number; period: Period }
    lastFiredAt: string | null
    createdAt: string
}

interface AlertsManagerProps {
    initialAlerts: AlertItem[]
}

const OP_LABEL: Record<Op, string> = {
    lt: "menor que",
    lte: "menor o igual que",
    gt: "mayor que",
    gte: "mayor o igual que",
    eq: "igual a",
}

const PERIOD_LABEL: Record<Period, string> = {
    today: "hoy",
    "7d": "últimos 7 días",
    "30d": "últimos 30 días",
}

const METRIC_LABEL: Record<string, string> = {
    sales_total: "Ventas",
    invoice_count: "Facturas",
    ticket_avg: "Ticket promedio",
    units_sold: "Unidades vendidas",
    gross_sales: "Ventas brutas",
    discounts: "Descuentos",
    unique_customers: "Clientes únicos",
    sales_subtotal: "Subtotal",
}

export function AlertsManager({ initialAlerts }: AlertsManagerProps) {
    const router = useRouter()
    const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts)
    const [creating, setCreating] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [toggling, setToggling] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [form, setForm] = useState({
        name: "",
        metric: "sales_total",
        op: "lt" as Op,
        value: "",
        period: "today" as Period,
    })

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        const value = parseFloat(form.value)
        if (!form.name.trim()) return setError("Ponle un nombre a la alerta.")
        if (!Number.isFinite(value)) return setError("El umbral debe ser un número.")
        setCreating(true)
        try {
            const res = await fetch("/api/bi/alerts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: form.name.trim(),
                    config: {
                        metric: form.metric,
                        op: form.op,
                        value,
                        period: form.period,
                    },
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
            setAlerts((prev) => [data.alert, ...prev])
            setForm({ name: "", metric: "sales_total", op: "lt", value: "", period: "today" })
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setCreating(false)
        }
    }

    const toggle = async (alert: AlertItem) => {
        setToggling(alert.id)
        try {
            const res = await fetch(`/api/bi/alerts/${alert.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !alert.isActive }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setAlerts((prev) => prev.map((a) => (a.id === alert.id ? data.alert : a)))
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setToggling(null)
        }
    }

    const remove = async (alert: AlertItem) => {
        if (!confirm(`¿Eliminar alerta "${alert.name}"?`)) return
        setDeleting(alert.id)
        try {
            const res = await fetch(`/api/bi/alerts/${alert.id}`, { method: "DELETE" })
            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error ?? `Error ${res.status}`)
            }
            setAlerts((prev) => prev.filter((a) => a.id !== alert.id))
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setDeleting(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Form de creación */}
            <form
                onSubmit={submit}
                className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-4"
            >
                <div className="flex items-center gap-2 mb-1">
                    <Plus className="h-4 w-4 text-violet-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Nueva alerta por umbral
                    </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
                    Te avisamos cuando la métrica cruce el valor que defines. Cooldown de 24h por alerta para no llenar tu inbox.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Nombre">
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Ej. Ventas bajas hoy"
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Métrica">
                        <select
                            value={form.metric}
                            onChange={(e) => setForm({ ...form, metric: e.target.value })}
                            className={inputCls}
                        >
                            {MEASURE_IDS.map((m) => (
                                <option key={m} value={m}>{METRIC_LABEL[m] ?? m}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Operador">
                        <select
                            value={form.op}
                            onChange={(e) => setForm({ ...form, op: e.target.value as Op })}
                            className={inputCls}
                        >
                            {(Object.keys(OP_LABEL) as Op[]).map((op) => (
                                <option key={op} value={op}>{OP_LABEL[op]}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Umbral (número)">
                        <input
                            type="number"
                            step="0.01"
                            value={form.value}
                            onChange={(e) => setForm({ ...form, value: e.target.value })}
                            placeholder="Ej. 500"
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Período">
                        <select
                            value={form.period}
                            onChange={(e) => setForm({ ...form, period: e.target.value as Period })}
                            className={inputCls}
                        >
                            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                                <option key={p} value={p}>{PERIOD_LABEL[p]}</option>
                            ))}
                        </select>
                    </Field>
                </div>

                {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-700 dark:text-rose-300">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={creating}
                    className={cn(
                        "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all",
                        "bg-violet-600 text-white hover:bg-violet-500",
                        creating && "opacity-70 cursor-wait",
                    )}
                >
                    {creating
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Plus className="h-4 w-4" />}
                    Crear alerta
                </button>
            </form>

            {/* Listado */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                    Alertas configuradas ({alerts.length})
                </h3>
                {alerts.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                        Aún no tienes alertas. Crea la primera arriba.
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-white/10">
                        {alerts.map((a) => (
                            <li key={a.id} className="py-3 flex items-center gap-3">
                                <Bell className={cn("h-4 w-4 shrink-0", a.isActive ? "text-violet-500" : "text-slate-300 dark:text-slate-600")} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {a.name}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        {METRIC_LABEL[a.config.metric] ?? a.config.metric} {OP_LABEL[a.config.op]} {a.config.value} en {PERIOD_LABEL[a.config.period]}
                                        {a.lastFiredAt && (
                                            <> · disparada por última vez {new Date(a.lastFiredAt).toLocaleString("es-PA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</>
                                        )}
                                    </p>
                                </div>
                                <button
                                    onClick={() => toggle(a)}
                                    disabled={toggling === a.id}
                                    className={cn(
                                        "text-xs font-semibold px-2.5 py-1 rounded-md border transition-all",
                                        a.isActive
                                            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
                                            : "border-slate-300 dark:border-white/10 text-slate-500",
                                        toggling === a.id && "opacity-50",
                                    )}
                                >
                                    {toggling === a.id
                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                        : a.isActive ? <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Activa</span> : "Pausada"}
                                </button>
                                <button
                                    onClick={() => remove(a)}
                                    disabled={deleting === a.id}
                                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                                    aria-label="Eliminar"
                                >
                                    {deleting === a.id
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <Trash2 className="h-4 w-4" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

const inputCls = "h-10 w-full rounded-md px-3 text-sm bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="space-y-1.5 block">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</span>
            {children}
        </label>
    )
}
