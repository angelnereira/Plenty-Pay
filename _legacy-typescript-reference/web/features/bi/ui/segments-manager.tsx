"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Loader2, Users, Send, X } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Field = "totalSpent" | "totalInvoices" | "ticketAvg" | "lastPurchaseDaysAgo"
type Op = "lt" | "lte" | "gt" | "gte" | "eq"

const FIELD_LABEL: Record<Field, string> = {
    totalSpent:           "Total gastado (USD)",
    totalInvoices:        "# de facturas",
    ticketAvg:            "Ticket promedio (USD)",
    lastPurchaseDaysAgo:  "Días desde última compra",
}

const OP_LABEL: Record<Op, string> = {
    lt: "<", lte: "≤", gt: ">", gte: "≥", eq: "=",
}

interface SegmentItem {
    id: string
    name: string
    rules: { entity: "customer"; rules: Array<{ field: string; op: string; value: number }> }
    cachedCount: number
    refreshedAt: string | null
}

interface Props {
    initialSegments: SegmentItem[]
}

export function SegmentsManager({ initialSegments }: Props) {
    const router = useRouter()
    const [segments, setSegments] = useState<SegmentItem[]>(initialSegments)
    const [name, setName] = useState("")
    const [rules, setRules] = useState<Array<{ field: Field; op: Op; value: string }>>([
        { field: "totalSpent", op: "gte", value: "100" },
    ])
    const [creating, setCreating] = useState(false)
    const [removing, setRemoving] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const addRule = () => setRules((prev) => [...prev, { field: "totalSpent", op: "gte", value: "0" }])
    const removeRule = (i: number) => setRules((prev) => prev.filter((_, j) => j !== i))

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!name.trim()) return setError("Ponle un nombre al segmento.")
        if (rules.length === 0) return setError("Agrega al menos una regla.")
        setCreating(true)
        try {
            const res = await fetch("/api/bi/segments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    rules: rules.map((r) => ({
                        field: r.field,
                        op: r.op,
                        value: parseFloat(r.value),
                    })),
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
            setSegments((prev) => [data.segment, ...prev])
            setName("")
            setRules([{ field: "totalSpent", op: "gte", value: "100" }])
            router.refresh()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setCreating(false)
        }
    }

    const remove = async (s: SegmentItem) => {
        if (!confirm(`¿Eliminar segmento "${s.name}"?`)) return
        setRemoving(s.id)
        try {
            await fetch(`/api/bi/segments/${s.id}`, { method: "DELETE" })
            setSegments((prev) => prev.filter((x) => x.id !== s.id))
        } finally {
            setRemoving(null)
        }
    }

    const inputCls = "h-10 w-full rounded-md px-3 text-sm bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-white"

    return (
        <div className="space-y-6">
            {/* Form */}
            <form onSubmit={submit} className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-4">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-violet-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Nuevo segmento</h3>
                </div>

                <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nombre</span>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Clientes VIP"
                        className={inputCls}
                    />
                </label>

                <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reglas</span>
                    {rules.map((r, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <select
                                value={r.field}
                                onChange={(e) => {
                                    const v = e.target.value as Field
                                    setRules((prev) => prev.map((x, j) => j === i ? { ...x, field: v } : x))
                                }}
                                className={cn(inputCls, "flex-1")}
                            >
                                {(Object.keys(FIELD_LABEL) as Field[]).map((f) => (
                                    <option key={f} value={f}>{FIELD_LABEL[f]}</option>
                                ))}
                            </select>
                            <select
                                value={r.op}
                                onChange={(e) => {
                                    const v = e.target.value as Op
                                    setRules((prev) => prev.map((x, j) => j === i ? { ...x, op: v } : x))
                                }}
                                className={cn(inputCls, "w-16 text-center")}
                            >
                                {(Object.keys(OP_LABEL) as Op[]).map((o) => (
                                    <option key={o} value={o}>{OP_LABEL[o]}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                step="0.01"
                                value={r.value}
                                onChange={(e) => {
                                    const v = e.target.value
                                    setRules((prev) => prev.map((x, j) => j === i ? { ...x, value: v } : x))
                                }}
                                className={cn(inputCls, "w-28")}
                            />
                            <button
                                type="button"
                                onClick={() => removeRule(i)}
                                className="p-2 text-slate-400 hover:text-rose-600"
                                aria-label="Eliminar regla"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addRule}
                        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                        + Agregar regla
                    </button>
                </div>

                {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

                <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-70"
                >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Crear segmento
                </button>
            </form>

            {/* Lista */}
            <div className="rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                    Mis segmentos ({segments.length})
                </h3>
                {segments.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
                        Aún no hay segmentos guardados.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-white/10">
                        {segments.map((s) => (
                            <li key={s.id} className="py-3 flex items-center gap-3">
                                <Users className="h-4 w-4 text-violet-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                        {s.name}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {s.cachedCount.toLocaleString("en-US")} clientes
                                        {s.refreshedAt && (
                                            <> · actualizado {new Date(s.refreshedAt).toLocaleDateString("es-PA")}</>
                                        )}
                                    </p>
                                </div>
                                <Link
                                    href={`/dashboard/bi/campaigns?segment=${s.id}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200 dark:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.06]"
                                >
                                    <Send className="h-3 w-3" />
                                    Campaña
                                </Link>
                                <button
                                    onClick={() => remove(s)}
                                    disabled={removing === s.id}
                                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-500/10"
                                    aria-label="Eliminar"
                                >
                                    {removing === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
