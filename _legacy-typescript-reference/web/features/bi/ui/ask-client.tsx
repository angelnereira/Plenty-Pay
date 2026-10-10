"use client"

import { useState } from "react"
import { Send, Loader2, Sparkles, MessageSquare } from "lucide-react"

const SAMPLES = [
    "¿Cuánto vendí este mes?",
    "¿Cuáles fueron mis 5 productos más vendidos?",
    "Mis mejores clientes",
    "Productos con stock bajo",
    "Clientes que no compran en 60 días",
    "Cuentas vencidas con crédito",
]

interface Answer {
    intent: string
    summary: string
    rows: Array<Record<string, unknown>>
}

export function AskClient() {
    const [question, setQuestion] = useState("")
    const [answer, setAnswer] = useState<Answer | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [history, setHistory] = useState<Array<{ q: string; a: Answer }>>([])

    const ask = async (q: string) => {
        if (q.trim().length < 3) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/bi/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: q }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
            setAnswer(data)
            setHistory((prev) => [{ q, a: data }, ...prev].slice(0, 6))
            setQuestion("")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-5">
            {/* Input */}
            <form
                onSubmit={(e) => { e.preventDefault(); ask(question) }}
                className="flex gap-2 items-center"
            >
                <div className="flex-1 relative">
                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Pregúntale a tu BI… ¿cuánto vendí esta semana?"
                        className="w-full h-12 rounded-xl pl-10 pr-3 text-sm bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/[0.1] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                </div>
                <button
                    type="submit"
                    disabled={loading || question.trim().length < 3}
                    className="h-12 px-4 rounded-xl bg-violet-600 text-white font-semibold text-sm flex items-center gap-2 hover:bg-violet-500 disabled:opacity-70"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Preguntar
                </button>
            </form>

            {/* Samples */}
            <div className="flex flex-wrap gap-2">
                {SAMPLES.map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => ask(s)}
                        disabled={loading}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:border-violet-500/40 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                    >
                        {s}
                    </button>
                ))}
            </div>

            {error && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
                    {error}
                </div>
            )}

            {/* Última respuesta + histórico */}
            {answer && (
                <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        <span className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                            Respuesta
                        </span>
                    </div>
                    <p className="text-base text-slate-900 dark:text-white leading-relaxed">
                        {answer.summary}
                    </p>
                    {answer.rows.length > 0 && (
                        <details className="mt-3">
                            <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-violet-600">
                                Ver datos crudos ({answer.rows.length} filas)
                            </summary>
                            <pre className="mt-2 text-[11px] bg-slate-900 text-slate-200 p-3 rounded-lg overflow-x-auto">
                                {JSON.stringify(answer.rows, bigintReplacer, 2)}
                            </pre>
                        </details>
                    )}
                </div>
            )}

            {history.length > 1 && (
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                        Preguntas anteriores
                    </h3>
                    <ul className="space-y-2">
                        {history.slice(1).map((h, i) => (
                            <li key={i} className="rounded-lg border border-slate-200 dark:border-white/[0.08] p-3 bg-white dark:bg-white/[0.03]">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{h.q}</p>
                                <p className="text-sm text-slate-900 dark:text-white">{h.a.summary}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

function bigintReplacer(_k: string, v: unknown) {
    return typeof v === "bigint" ? Number(v) : v
}
