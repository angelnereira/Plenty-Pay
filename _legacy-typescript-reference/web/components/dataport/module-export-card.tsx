"use client"

/**
 * ModuleExportCard — sección de exportación de datos por módulo (SDS/DataPort).
 *
 * Componente autocontenido: consulta `/api/dataport/catalog`, filtra los
 * datasets de SU módulo y permite exportarlos en CSV/XLSX/JSON. Se incrusta en
 * la página de configuración de cada módulo (Facturas, Inventario, POS, etc.).
 *
 * Si el módulo no está habilitado, no hay datasets, o el actor no tiene permiso
 * de exportación, el componente no renderiza nada (no ensucia la config).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { Database, Download, Loader2, ShieldCheck, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type Format = "csv" | "xlsx" | "json"

/** Clave de módulo DataPort (debe coincidir con core/dataport DataModule). */
export type DataportModule =
    | "invoicing"
    | "inventory"
    | "pos"
    | "logistics"
    | "payday"
    | "bi"
    | "credits"

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
interface Catalog {
    capabilities: ModuleCap[]
    permissions: { canExport: boolean; canImport: boolean; elevated: boolean }
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

function isSensitive(d: DatasetCap): boolean {
    return d.sensitivity === "pii" || d.sensitivity === "fiscal"
}

export function ModuleExportCard({ module }: { module: DataportModule }) {
    const [catalog, setCatalog] = useState<Catalog | null>(null)
    const [loading, setLoading] = useState(true)
    const [format, setFormat] = useState<Format>("csv")
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        let active = true
        ;(async () => {
            try {
                const res = await fetch("/api/dataport/catalog")
                if (!res.ok) return
                const data: Catalog = await res.json()
                if (active) setCatalog(data)
            } catch {
                // silencioso: la sección simplemente no aparece
            } finally {
                if (active) setLoading(false)
            }
        })()
        return () => {
            active = false
        }
    }, [])

    const cap = useMemo(
        () => catalog?.capabilities.find((m) => m.module === module) ?? null,
        [catalog, module],
    )
    const elevated = catalog?.permissions.elevated ?? false

    // Datasets que el actor puede exportar (los sensibles requieren permiso elevado).
    const exportable = useMemo(
        () => (cap?.datasets ?? []).filter((d) => elevated || !isSensitive(d)),
        [cap, elevated],
    )

    // Por defecto, todos los exportables seleccionados.
    useEffect(() => {
        setSelected(new Set(exportable.map((d) => d.key)))
    }, [exportable])

    const toggle = useCallback((key: string) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const doExport = async () => {
        const datasets = exportable.map((d) => d.key).filter((k) => selected.has(k))
        if (datasets.length === 0) {
            toast.error("Selecciona al menos un conjunto de datos")
            return
        }
        setBusy(true)
        try {
            const res = await fetch("/api/dataport/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scope: "dataset", datasets, format }),
            })
            if (!res.ok) {
                const msg = (await res.json().catch(() => ({}))).error ?? `Error ${res.status}`
                throw new Error(msg)
            }
            const cd = res.headers.get("Content-Disposition") ?? ""
            const fname = /filename="(.+?)"/.exec(cd)?.[1] ?? `export.${format}`
            downloadBlob(await res.blob(), fname)
            toast.success("Exportación lista")
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al exportar")
        } finally {
            setBusy(false)
        }
    }

    // No renderizar si: cargando, módulo inexistente/no habilitado, sin permiso,
    // o sin datasets exportables para este actor.
    if (loading) return null
    if (!cap || !cap.enabled) return null
    if (!catalog?.permissions.canExport) return null
    if (exportable.length === 0) return null

    return (
        <section className="rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] p-5">
            <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/20 shrink-0">
                    <Database className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                        Datos / Exportar
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Descarga tus datos de {cap.label.toLowerCase()} en el formato que prefieras.
                    </p>
                </div>
            </div>

            {/* Selector de formato */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Formato</span>
                {(["csv", "xlsx", "json"] as Format[]).map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                            format === f
                                ? "bg-violet-600 text-white border-violet-600"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300",
                        )}
                    >
                        {f.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* Conjuntos de datos */}
            <ul className="space-y-1.5 mb-4">
                {exportable.map((d) => (
                    <li key={d.key}>
                        <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={selected.has(d.key)}
                                onChange={() => toggle(d.key)}
                                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            />
                            <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="text-slate-700 dark:text-slate-300">{d.label}</span>
                            {isSensitive(d) && (
                                <ShieldCheck
                                    className="h-3.5 w-3.5 text-amber-500 shrink-0"
                                    aria-label="Datos sensibles"
                                />
                            )}
                        </label>
                    </li>
                ))}
            </ul>

            <button
                type="button"
                onClick={doExport}
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Descargar
            </button>

            <p className="mt-3 text-xs text-slate-400">
                ¿Necesitas importar, programar respaldos o ver el historial?{" "}
                <a href="/dashboard/datos" className="text-violet-600 dark:text-violet-400 font-medium hover:underline">
                    Ir a Soberanía de Datos →
                </a>
            </p>
        </section>
    )
}
