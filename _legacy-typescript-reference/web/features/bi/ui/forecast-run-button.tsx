"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Loader2 } from "lucide-react"

interface Props {
    metric: "sales_total" | "invoice_count"
}

export function ForecastRunButton({ metric }: Props) {
    const router = useRouter()
    const [running, setRunning] = useState(false)
    const run = async () => {
        setRunning(true)
        try {
            await fetch("/api/bi/forecast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ metric }),
            })
            router.refresh()
        } finally {
            setRunning(false)
        }
    }
    return (
        <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-70"
        >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recalcular
        </button>
    )
}
