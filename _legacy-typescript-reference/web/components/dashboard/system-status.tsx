"use client"

import { useEffect, useState } from "react"
import { Activity, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export type SystemStatus = 'operational' | 'degraded' | 'down' | 'loading'

export function SystemStatusIndicator() {
    const [status, setStatus] = useState<SystemStatus>('loading')

    useEffect(() => {
        checkStatus()
        // Poll cada 60 segundos
        const interval = setInterval(checkStatus, 60000)
        return () => clearInterval(interval)
    }, [])

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/status')
            if (res.ok) {
                const data = await res.json()
                setStatus(data.status as SystemStatus)
            } else {
                setStatus('down')
            }
        } catch (e) {
            setStatus('down')
        }
    }

    const config = {
        operational: {
            color: "text-emerald-700 dark:text-emerald-400",
            bg: "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-800/50",
            icon: CheckCircle2,
            label: "HKA EN LÍNEA"
        },
        degraded: {
            color: "text-amber-700 dark:text-amber-400",
            bg: "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-800/50",
            icon: Activity,
            label: "PROC. LENTO"
        },
        down: {
            color: "text-rose-700 dark:text-rose-400",
            bg: "bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-800/50",
            icon: AlertCircle,
            label: "RESTRICCIÓN HKA"
        },
        loading: {
            color: "text-slate-500 dark:text-slate-400",
            bg: "bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20",
            icon: Activity,
            label: "Verificando..."
        }
    }

    const { color, bg, icon: Icon, label } = config[status]

    return (
        <div title="Estado de Sistemas" className={cn("hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500 cursor-default select-none group", bg)}>
            <Icon className={cn("h-4 w-4", color, status === 'loading' && "animate-pulse")} />
            <span className={cn("text-[11px] font-bold uppercase tracking-wider", color)}>{label}</span>
            {status !== 'loading' && (
                <span className="relative flex h-2 w-2 ml-1">
                    {status === 'operational' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={cn("relative inline-flex rounded-full h-2 w-2 transition-colors duration-500", {
                        "bg-emerald-500": status === 'operational',
                        "bg-amber-500": status === 'degraded',
                        "bg-rose-500": status === 'down'
                    })}></span>
                </span>
            )}
        </div>
    )
}
