"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
    variant?: "primary" | "secondary"
}

export function CreateDashboardButton({ variant = "secondary" }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [name, setName] = useState("Mi tablero")
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (name.trim().length < 2) return setError("Nombre muy corto.")
        setCreating(true)
        setError(null)
        try {
            const res = await fetch("/api/bi/dashboards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
            router.push(`/dashboard/bi/dashboards/${data.dashboard.id}`)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
            setCreating(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all",
                    variant === "primary"
                        ? "bg-violet-600 text-white hover:bg-violet-500"
                        : "border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.06]",
                )}
            >
                <Plus className="h-4 w-4" />
                Nuevo tablero
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <form
                        onSubmit={submit}
                        className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl p-5 space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Crear tablero
                            </h3>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <label className="block space-y-1.5">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Nombre
                            </span>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                className="w-full h-10 rounded-md px-3 text-sm bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-white"
                            />
                        </label>
                        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
                        <button
                            type="submit"
                            disabled={creating}
                            className="w-full h-10 rounded-md bg-violet-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-violet-500 disabled:opacity-70"
                        >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Crear y abrir
                        </button>
                    </form>
                </div>
            )}
        </>
    )
}
