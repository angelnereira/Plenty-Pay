"use client"

import { useState } from "react"
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BIQuery } from "../model/types/bi.types"

interface ExportButtonProps {
    title: string
    subtitle?: string
    filename: string
    query: BIQuery
}

/**
 * Botón "Exportar" con menú desplegable Excel / PDF. POST a
 * /api/bi/export y dispara descarga via Blob.
 */
export function ExportButton({ title, subtitle, filename, query }: ExportButtonProps) {
    const [open, setOpen] = useState(false)
    const [downloading, setDownloading] = useState<"xlsx" | "pdf" | null>(null)
    const [error, setError] = useState<string | null>(null)

    const download = async (format: "xlsx" | "pdf") => {
        setDownloading(format)
        setError(null)
        try {
            const res = await fetch("/api/bi/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ format, title, subtitle, filename, query }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => null)
                throw new Error(data?.error ?? `Error ${res.status}`)
            }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `${filename}.${format}`
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
                className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                    "bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.1] text-slate-900 dark:text-white",
                    "hover:bg-slate-50 dark:hover:bg-white/[0.06]",
                )}
            >
                <Download className="h-4 w-4" />
                Exportar
            </button>

            {open && (
                <>
                    <div
                        className="fixed inset-0 z-30"
                        onClick={() => setOpen(false)}
                        aria-hidden
                    />
                    <div className="absolute right-0 mt-2 w-56 z-40 rounded-xl border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => download("xlsx")}
                            disabled={downloading !== null}
                            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-50"
                        >
                            {downloading === "xlsx"
                                ? <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
                                : <FileSpreadsheet className="h-4 w-4 text-emerald-500" />}
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">Excel</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">.xlsx</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => download("pdf")}
                            disabled={downloading !== null}
                            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-50 border-t border-slate-200 dark:border-white/[0.06]"
                        >
                            {downloading === "pdf"
                                ? <Loader2 className="h-4 w-4 text-rose-500 animate-spin" />
                                : <FileText className="h-4 w-4 text-rose-500" />}
                            <div>
                                <p className="font-semibold text-slate-900 dark:text-white">PDF</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">.pdf</p>
                            </div>
                        </button>
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
