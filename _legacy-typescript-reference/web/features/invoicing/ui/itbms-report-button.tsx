"use client"

import { useState } from "react"
import { FileText, Loader2, Calculator } from "lucide-react"
import { cn } from "@/lib/utils"

/** Opciones de periodo para el reporte de ITBMS. */
const PERIOD_OPTIONS: Array<{ key: string; label: string }> = [
    { key: "mtd", label: "Mes en curso" },
    { key: "30d", label: "Últimos 30 días" },
    { key: "ytd", label: "Año en curso" },
    { key: "all", label: "Todo el histórico" },
]

/**
 * Botón "Reporte ITBMS" con menú de periodo. Descarga el PDF formal desde
 * GET /api/reports/itbms?period=... (patrón de features/bi/ui/export-button.tsx).
 */
export function ItbmsReportButton() {
    const [open, setOpen] = useState(false)
    const [downloading, setDownloading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const download = async (period: string) => {
        setDownloading(period)
        setError(null)
        try {
            const res = await fetch(`/api/reports/itbms?period=${encodeURIComponent(period)}`)
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? `Error ${res.status}`)
            }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `reporte-itbms-${period}.pdf`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
            setOpen(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setDownloading(null)
        }
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                className={cn(
                    "flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
                    "hover:border-violet-400 dark:hover:border-violet-500 text-slate-700 dark:text-slate-300",
                    "rounded-xl font-medium transition-colors shadow-sm p-2.5 md:px-4 md:py-2.5 whitespace-nowrap",
                )}
                aria-label="Reporte de recaudación de impuestos"
            >
                <Calculator size={18} className="text-violet-500" />
                <span className="hidden md:inline">Recaudación</span>
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
                    <div
                        role="menu"
                        className="absolute right-0 mt-2 w-60 z-50 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                    >
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                            Recaudación de impuestos · PDF
                        </div>
                        {PERIOD_OPTIONS.map((opt) => (
                            <button
                                key={opt.key}
                                type="button"
                                role="menuitem"
                                onClick={() => download(opt.key)}
                                disabled={downloading !== null}
                                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-50"
                            >
                                {downloading === opt.key
                                    ? <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />
                                    : <FileText className="h-4 w-4 text-violet-500" />}
                                {opt.label}
                            </button>
                        ))}
                        {error && (
                            <div className="px-3 py-2 text-[11px] text-rose-600 dark:text-rose-400 border-t border-slate-200 dark:border-white/[0.06]">
                                {error}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
