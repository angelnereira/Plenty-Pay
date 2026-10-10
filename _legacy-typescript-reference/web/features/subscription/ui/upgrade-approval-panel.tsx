"use client"

import { useState } from "react"
import {
    Check,
    X,
    Loader2,
    ArrowRight,
    AlertTriangle,
    Zap,
    Crown,
    Building2,
    Sparkles,
    Package,
    Store,
    Users,
    MonitorSmartphone
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface UpgradeApprovalPanelProps {
    ticketId: string
    clientId: string // Need to pass clientId somehow, likely from ticket.user.clientId or similar if available
    metadata: {
        type: string
        currentPlan: string
        requestedPlan: string | null
        requestedAddons: string[]
        extraUsers: number
        extraPosStations: number
        customerMessage?: string
    }
    onProcessed: () => void
}

const PLAN_LABELS: Record<string, string> = {
    CRECIMIENTO: "Crecimiento",
    PROFESIONAL: "Profesional",
    EMPRESARIAL: "Empresarial",
    ENTERPRISE: "Enterprise"
}

const ADDON_LABELS: Record<string, string> = {
    inventory: "Inventario Pro",
    pos: "Punto de Venta"
}

export function UpgradeApprovalPanel({ ticketId, metadata, onProcessed }: UpgradeApprovalPanelProps) {
    const [isProcessing, setIsProcessing] = useState(false)

    const handleApprove = async () => {
        if (!confirm("¿Estás seguro de aprobar esta solicitud? Se actualizarán los límites del cliente inmediatamente.")) return

        setIsProcessing(true)
        try {
            const res = await fetch("/api/admin/approve-upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketId, action: "APPROVE" })
            })

            const data = await res.json()
            if (data.success) {
                toast.success("Solicitud aprobada y cambios aplicados exitosamente.")
                onProcessed()
            } else {
                toast.error(data.error || "Error al aprobar solicitud")
            }
        } catch (e) {
            toast.error("Error de conexión")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleReject = async () => {
        const reason = prompt("Razón del rechazo (opcional):")
        if (reason === null) return // Cancelled

        setIsProcessing(true)
        try {
            const res = await fetch("/api/admin/approve-upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticketId, action: "REJECT", reason })
            })

            const data = await res.json()
            if (data.success) {
                toast.success("Solicitud rechazada.")
                onProcessed()
            } else {
                toast.error(data.error || "Error al rechazar solicitud")
            }
        } catch (e) {
            toast.error("Error de conexión")
        } finally {
            setIsProcessing(false)
        }
    }

    return (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
                    <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-amber-900 dark:text-amber-100 text-sm uppercase tracking-wide mb-3">
                        Solicitud de Upgrade Pendiente
                    </h3>

                    <div className="space-y-4 mb-4">
                        {/* Plan Change */}
                        {metadata.requestedPlan && metadata.requestedPlan !== metadata.currentPlan && (
                            <div className="flex items-center gap-2 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                <span className="text-xs font-bold text-zinc-500 uppercase">Plan</span>
                                <span className="font-medium text-zinc-900 dark:text-zinc-300">{PLAN_LABELS[metadata.currentPlan]}</span>
                                <ArrowRight className="h-4 w-4 text-amber-500" />
                                <span className="font-bold text-amber-600 dark:text-amber-400">{PLAN_LABELS[metadata.requestedPlan]}</span>
                            </div>
                        )}

                        {/* Addons */}
                        {metadata.requestedAddons && metadata.requestedAddons.length > 0 && (
                            <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                <span className="text-xs font-bold text-zinc-500 uppercase block mb-2">Módulos Nuevos</span>
                                <div className="space-y-1">
                                    {metadata.requestedAddons.map(addon => (
                                        <div key={addon} className="flex items-center gap-2">
                                            {addon === 'inventory' ? <Package className="h-4 w-4 text-emerald-500" /> : <Store className="h-4 w-4 text-violet-500" />}
                                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{ADDON_LABELS[addon]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Limits */}
                        {(metadata.extraUsers > 0 || metadata.extraPosStations > 0) && (
                            <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-amber-100 dark:border-amber-900/30">
                                <span className="text-xs font-bold text-zinc-500 uppercase block mb-2">Ampliación de Límites</span>
                                <div className="space-y-1">
                                    {metadata.extraUsers > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">+{metadata.extraUsers} Usuarios extra</span>
                                        </div>
                                    )}
                                    {metadata.extraPosStations > 0 && (
                                        <div className="flex items-center gap-2">
                                            <MonitorSmartphone className="h-4 w-4 text-green-500" />
                                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">+{metadata.extraPosStations} Cajas POS extra</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleApprove}
                            disabled={isProcessing}
                            className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Aprobar y Aplicar
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={isProcessing}
                            className="px-4 py-2 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
