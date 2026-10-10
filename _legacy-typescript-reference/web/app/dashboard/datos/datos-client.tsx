"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Database, Download, Upload, CalendarClock, Loader2, ShieldCheck, FileText, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Format = "csv" | "xlsx" | "json"

interface DatasetCap {
    key: string
    label: string
    sensitivity: string
    mutability: string
    importable: boolean
}
interface ModuleCap {
    module: string
    label: string
    enabled: boolean
    datasets: DatasetCap[]
}
interface HistoryRow {
    id: string
    direction: string
    scope: string
    datasets: string[]
    format: string
    byteSize: number | null
    deliveryChannel: string
    reproducible: boolean
    actorEmail: string | null
    createdAt: string
    message: string | null
}
interface ScheduleRow {
    id: string
    name: string
    frequency: string
    format: string
    scope: string
    recipients: string[]
    nextRunAt: string | null
}
interface Catalog {
    capabilities: ModuleCap[]
    permissions: { canExport: boolean; canImport: boolean; elevated: boolean }
    history: HistoryRow[]
    schedules: ScheduleRow[]
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

export function DatosClient() {
    const [catalog, setCatalog] = useState<Catalog | null>(null)
    const [loading, setLoading] = useState(true)
    const [format, setFormat] = useState<Format>("csv")
    const [busy, setBusy] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/dataport/catalog")
            if (!res.ok) throw new Error((await res.json()).error ?? "Error")
            setCatalog(await res.json())
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error cargando catálogo")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { void load() }, [load])

    const doExport = async (body: Record<string, unknown>, label: string) => {
        setBusy(label)
        try {
            const res = await fetch("/api/dataport/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...body, format }),
            })
            if (!res.ok) throw new Error((await res.json()).error ?? `Error ${res.status}`)
            const cd = res.headers.get("Content-Disposition") ?? ""
            const fname = /filename="(.+?)"/.exec(cd)?.[1] ?? `export.${format}`
            downloadBlob(await res.blob(), fname)
            toast.success("Exportación lista")
            void load()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al exportar")
        } finally {
            setBusy(null)
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>
    }
    if (!catalog) return null

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-transparent pb-24 md:pb-12">
            <main className="max-w-7xl mx-auto px-4 pt-4 md:px-8 md:pt-8 space-y-6">
                <header className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-violet-100 dark:bg-violet-500/20">
                        <Database className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Soberanía de Datos</h1>
                        <p className="text-sm text-slate-500">Exporta, importa, programa y audita los datos de tu organización.</p>
                    </div>
                </header>

                {/* Formato + export global */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] p-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Formato</span>
                        {(["csv", "xlsx", "json"] as Format[]).map((f) => (
                            <button key={f} onClick={() => setFormat(f)}
                                className={cn("px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                                    format === f ? "bg-violet-600 text-white border-violet-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>
                                {f.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    {catalog.permissions.canExport && (
                        <button onClick={() => doExport({ scope: "tenant" }, "tenant")} disabled={busy !== null}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">
                            {busy === "tenant" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Exportar todo el tenant (ZIP)
                        </button>
                    )}
                </div>

                {/* Módulos y datasets */}
                <div className="grid gap-4 md:grid-cols-2">
                    {catalog.capabilities.map((m) => (
                        <div key={m.module} className={cn("rounded-xl border p-4",
                            m.enabled ? "border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04]" : "border-slate-200/60 dark:border-white/[0.05] bg-slate-50 dark:bg-white/[0.02] opacity-60")}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm">{m.label}</h3>
                                {m.enabled
                                    ? catalog.permissions.canExport && (
                                        <button onClick={() => doExport({ scope: "module", modules: [m.module] }, `mod-${m.module}`)} disabled={busy !== null}
                                            className="text-[11px] font-bold text-violet-600 dark:text-violet-400 inline-flex items-center gap-1 hover:underline">
                                            {busy === `mod-${m.module}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} Módulo
                                        </button>
                                    )
                                    : <span className="text-[10px] font-bold uppercase text-slate-400">No habilitado</span>}
                            </div>
                            <ul className="space-y-1.5">
                                {m.datasets.map((d) => (
                                    <li key={d.key} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="flex items-center gap-1.5 min-w-0">
                                            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate text-slate-700 dark:text-slate-300">{d.label}</span>
                                            {(d.sensitivity === "pii" || d.sensitivity === "fiscal") && (
                                                <ShieldCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                            )}
                                            {d.importable && <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 rounded px-1">imp</span>}
                                        </span>
                                        {m.enabled && catalog.permissions.canExport && (
                                            <button onClick={() => doExport({ scope: "dataset", datasets: [d.key] }, d.key)} disabled={busy !== null}
                                                className="text-slate-400 hover:text-violet-600 shrink-0">
                                                {busy === d.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {catalog.permissions.canImport && <ImportPanel catalog={catalog} onDone={load} />}

                <SchedulePanel catalog={catalog} onChange={load} />

                {/* Historial / evidencia */}
                <section className="rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] p-4">
                    <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm mb-3">Historial de evidencia</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-slate-400 uppercase tracking-wide">
                                    <th className="py-1.5 pr-3">Fecha</th><th className="pr-3">Dir.</th><th className="pr-3">Datasets</th>
                                    <th className="pr-3">Formato</th><th className="pr-3">Canal</th><th className="pr-3">Repro.</th><th className="pr-3">SHA-256</th>
                                </tr>
                            </thead>
                            <tbody>
                                {catalog.history.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-slate-400">Sin operaciones aún</td></tr>}
                                {catalog.history.map((h) => (
                                    <tr key={h.id} className="border-t border-slate-100 dark:border-white/[0.06]">
                                        <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(h.createdAt).toLocaleString("es-PA")}</td>
                                        <td className="pr-3">{h.direction}</td>
                                        <td className="pr-3 max-w-[180px] truncate">{h.datasets.join(", ")}</td>
                                        <td className="pr-3 uppercase">{h.format}</td>
                                        <td className="pr-3">{h.deliveryChannel}</td>
                                        <td className="pr-3">{h.reproducible ? "✓" : "—"}</td>
                                        <td className="pr-3 font-mono text-[10px] text-slate-400">{h.id.slice(0, 8)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    )
}

// ── Import ────────────────────────────────────────────────────────────────
function ImportPanel({ catalog, onDone }: { catalog: Catalog; onDone: () => void }) {
    const importables = catalog.capabilities.filter((m) => m.enabled).flatMap((m) => m.datasets.filter((d) => d.importable))
    const [dataset, setDataset] = useState(importables[0]?.key ?? "")
    const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
    const [busy, setBusy] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    if (importables.length === 0) return null

    const send = async (mode: "dry-run" | "commit") => {
        const file = fileRef.current?.files?.[0]
        if (!file) { toast.error("Selecciona un archivo CSV o JSON"); return }
        setBusy(true)
        try {
            const fd = new FormData()
            fd.append("file", file)
            fd.append("dataset", dataset)
            fd.append("mode", mode)
            const res = await fetch("/api/dataport/import", { method: "POST", body: fd })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? "Error")
            setPreview(data.result)
            if (mode === "commit") { toast.success("Importación aplicada"); onDone() }
            else toast.success("Validación lista (dry-run)")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al importar")
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] p-4">
            <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2"><Upload className="h-4 w-4 text-emerald-500" /> Importar (datos maestros)</h3>
            <div className="flex flex-wrap items-center gap-3">
                <select value={dataset} onChange={(e) => { setDataset(e.target.value); setPreview(null) }}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                    {importables.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
                <input ref={fileRef} type="file" accept=".csv,.json" className="text-sm" />
                <button onClick={() => send("dry-run")} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-700 disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar (dry-run)"}
                </button>
                <button onClick={() => send("commit")} disabled={busy || !preview} className="px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white disabled:opacity-50">
                    Aplicar
                </button>
            </div>
            {preview && (
                <div className="mt-3 text-xs bg-slate-50 dark:bg-white/[0.03] rounded-lg p-3 font-mono">
                    total={String(preview.totalRows)} · válidas={String(preview.validRows)} · inválidas={String(preview.invalidRows)} · nuevas={String(preview.toInsert)} · actualiza={String(preview.toUpdate)}
                    {Array.isArray(preview.errors) && (preview.errors as unknown[]).length > 0 && (
                        <div className="mt-1 text-rose-500">errores: {(preview.errors as { row: number; field?: string; message: string }[]).slice(0, 5).map((e) => `fila ${e.row} ${e.field ?? ""}: ${e.message}`).join(" | ")}</div>
                    )}
                </div>
            )}
        </section>
    )
}

// ── Schedules ───────────────────────────────────────────────────────────────
function SchedulePanel({ catalog, onChange }: { catalog: Catalog; onChange: () => void }) {
    const [name, setName] = useState("Respaldo semanal")
    const [frequency, setFrequency] = useState("WEEKLY")
    const [format, setFormat] = useState("csv")
    const [recipients, setRecipients] = useState("")
    const [busy, setBusy] = useState(false)

    const create = async () => {
        setBusy(true)
        try {
            const res = await fetch("/api/dataport/schedules", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, frequency, format, scope: "tenant", periodWindow: "ROLLING_30D", recipients: recipients.split(",").map((s) => s.trim()).filter(Boolean) }),
            })
            if (!res.ok) throw new Error((await res.json()).error ?? "Error")
            toast.success("Programación creada"); onChange()
        } catch (e) { toast.error(e instanceof Error ? e.message : "Error") } finally { setBusy(false) }
    }
    const remove = async (id: string) => {
        await fetch(`/api/dataport/schedules?id=${id}`, { method: "DELETE" }); onChange()
    }

    return (
        <section className="rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] p-4">
            <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-violet-500" /> Exportaciones programadas (por correo)</h3>
            {catalog.permissions.canExport && (
                <div className="flex flex-wrap items-end gap-2 mb-3">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" />
                    <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                        <option value="DAILY">Diaria</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensual</option>
                    </select>
                    <select value={format} onChange={(e) => setFormat(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm">
                        <option value="csv">CSV</option><option value="xlsx">XLSX</option><option value="json">JSON</option>
                    </select>
                    <input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="correos (coma)" className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm flex-1 min-w-[160px]" />
                    <button onClick={create} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white disabled:opacity-50">Crear</button>
                </div>
            )}
            <ul className="space-y-1.5">
                {catalog.schedules.length === 0 && <li className="text-xs text-slate-400">Sin programaciones</li>}
                {catalog.schedules.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm border-t border-slate-100 dark:border-white/[0.06] py-1.5">
                        <span className="truncate">{s.name} · <span className="text-slate-400">{s.frequency} · {s.format.toUpperCase()} · {s.recipients.join(", ")}</span></span>
                        <button onClick={() => remove(s.id)} className="text-slate-400 hover:text-rose-500 shrink-0"><Trash2 className="h-4 w-4" /></button>
                    </li>
                ))}
            </ul>
        </section>
    )
}
