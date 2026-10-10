"use client"

import { AlertCircle, Clock, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface DemoModeBannerProps {
    approvalStatus: string
    demoStartDate?: string | null
    demoEndDate?: string | null
}

export function DemoModeBanner({ approvalStatus, demoStartDate, demoEndDate }: DemoModeBannerProps) {
    // Solo mostrar si está en modo PENDING
    if (approvalStatus !== "PENDING") {
        return null
    }

    // Calcular días restantes
    let daysRemaining = 14
    if (demoEndDate) {
        const now = new Date()
        const endDate = new Date(demoEndDate)
        const diffTime = endDate.getTime() - now.getTime()
        daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    }

    const isExpiringSoon = daysRemaining <= 3
    const isExpired = daysRemaining === 0

    return (
        <div
            className={cn(
                "relative overflow-hidden border-b transition-colors",
                isExpired
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
                    : isExpiringSoon
                        ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900"
                        : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900"
            )}
        >
            {/* Decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50" />

            <div className="relative mx-auto max-w-7xl px-6 py-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                        <div
                            className={cn(
                                "flex-shrink-0 rounded-full p-2",
                                isExpired
                                    ? "bg-red-100 dark:bg-red-900/50"
                                    : isExpiringSoon
                                        ? "bg-orange-100 dark:bg-orange-900/50"
                                        : "bg-blue-100 dark:bg-blue-900/50"
                            )}
                        >
                            {isExpired ? (
                                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            ) : (
                                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {isExpired ? (
                                    "Período de prueba finalizado"
                                ) : (
                                    <>
                                        <span className="font-black">{daysRemaining} {daysRemaining === 1 ? "día" : "días"}</span> restantes en período de prueba
                                    </>
                                )}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                Tu solicitud de módulos está pendiente de aprobación. Solo el módulo de facturación está disponible.
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/dashboard/support"
                        className={cn(
                            "flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs transition-all",
                            isExpired
                                ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                                : "bg-white dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1]"
                        )}
                    >
                        <MessageCircle className="h-4 w-4" />
                        <span>Contactar Soporte</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}
