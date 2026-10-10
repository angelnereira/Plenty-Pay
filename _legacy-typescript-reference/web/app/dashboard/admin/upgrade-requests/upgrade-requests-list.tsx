"use client"

import { useState } from "react"
import { Card } from "@shared/ui/card"
import { Button } from "@shared/ui/button"
import { Badge } from "@shared/ui/badge"
import { Check, X, Clock, Package, Store, UserCheck, Users, MonitorSmartphone, Loader2, Truck, FileText, CreditCard, Code, Building2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { MotorCreditTier } from "@prisma/client"

interface UpgradeRequest {
    id: string
    currentPlan: string
    requestedPlan: string | null
    requestedModules: string[]
    requestedCreditTier: MotorCreditTier | null
    requestedApiAccess: boolean | null
    requestedExtraBranches: number
    extraUsers: number
    extraPosStations: number
    message: string | null
    status: string
    createdAt: Date
    client: {
        id: string
        name: string
        planType: string
        facturacionEnabled: boolean
        inventoryEnabled: boolean
        posEnabled: boolean
        paydayEnabled: boolean
        logisticsEnabled: boolean
        creditosEnabled: boolean
        motorCreditTier: MotorCreditTier | null
        apiAccessEnabled: boolean
        maxUsers: number
        maxPosStations: number
        extraBranches: number
    }
    user: {
        id: string
        name: string | null
        email: string
    }
}

const MODULE_INFO: Record<string, { icon: typeof Package; label: string; color: string }> = {
    facturacion: { icon: FileText,   label: "Facturación electrónica", color: "text-blue-500" },
    inventory:   { icon: Package,    label: "Inventario Pro",          color: "text-emerald-500" },
    pos:         { icon: Store,      label: "Punto de Venta",          color: "text-violet-500" },
    payday:      { icon: UserCheck,  label: "Nómina Legal",            color: "text-blue-500" },
    logistics:   { icon: Truck,      label: "Logística y Despacho",    color: "text-amber-500" },
    creditos:    { icon: CreditCard, label: "Módulo de Créditos",      color: "text-rose-500" },
    apiAccess:   { icon: Code,       label: "API Access",              color: "text-emerald-500" },
}

export function UpgradeRequestsList({ requests }: { requests: UpgradeRequest[] }) {
    const router = useRouter()
    const [processingId, setProcessingId] = useState<string | null>(null)

    const handleApprove = async (req: UpgradeRequest) => {
        setProcessingId(req.id)

        try {
            const response = await fetch("/api/admin/approve-upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestId: req.id,
                    clientId: req.client.id,
                    requestedPlan: req.requestedPlan,
                    requestedModules: req.requestedModules,
                    requestedCreditTier: req.requestedCreditTier,
                    requestedApiAccess: req.requestedApiAccess,
                    requestedExtraBranches: req.requestedExtraBranches,
                    extraUsers: req.extraUsers,
                    extraPosStations: req.extraPosStations
                })
            })

            if (response.ok) {
                toast.success("Solicitud aprobada y cambios aplicados")
                router.refresh()
            } else {
                const error = await response.json()
                throw new Error(error.error || "Error al aprobar")
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al aprobar")
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (id: string) => {
        setProcessingId(id)

        try {
            const response = await fetch("/api/admin/reject-upgrade", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requestId: id })
            })

            if (response.ok) {
                toast.success("Solicitud rechazada")
                router.refresh()
            } else {
                throw new Error("Error al rechazar")
            }
        } catch (error) {
            toast.error("Error al rechazar la solicitud")
        } finally {
            setProcessingId(null)
        }
    }

    if (requests.length === 0) {
        return (
            <Card className="p-12 text-center">
                <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    No hay solicitudes pendientes
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                    Las solicitudes de upgrade aparecerán aquí
                </p>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {requests.map((req) => (
                <Card key={req.id} className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {req.client.name}
                            </h3>
                            <p className="text-sm text-slate-500">
                                {req.user.name} • {req.user.email} • {new Date(req.createdAt).toLocaleDateString('es-PA')}
                            </p>
                        </div>
                        <Badge className="bg-yellow-500/10 text-yellow-700">Pendiente</Badge>
                    </div>

                    {/* Current State */}
                    <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-xs font-bold text-slate-500 mb-2">PLAN ACTUAL: {req.currentPlan}</p>
                        <div className="flex gap-2 flex-wrap">
                            {req.client.facturacionEnabled && <Badge variant="outline" className="text-blue-600"><FileText className="h-3 w-3 mr-1" />Facturación</Badge>}
                            {req.client.inventoryEnabled && <Badge variant="outline" className="text-emerald-600"><Package className="h-3 w-3 mr-1" />Inventario</Badge>}
                            {req.client.posEnabled && <Badge variant="outline" className="text-violet-600"><Store className="h-3 w-3 mr-1" />POS</Badge>}
                            {req.client.paydayEnabled && <Badge variant="outline" className="text-blue-600"><UserCheck className="h-3 w-3 mr-1" />Nómina</Badge>}
                            {req.client.logisticsEnabled && <Badge variant="outline" className="text-amber-600"><Truck className="h-3 w-3 mr-1" />Logística</Badge>}
                            {req.client.creditosEnabled && req.client.motorCreditTier && (
                                <Badge variant="outline" className="text-rose-600">
                                    <CreditCard className="h-3 w-3 mr-1" />Créditos · {req.client.motorCreditTier.replace("TIER_", "Tier ")}
                                </Badge>
                            )}
                            {req.client.apiAccessEnabled && <Badge variant="outline" className="text-emerald-600"><Code className="h-3 w-3 mr-1" />API</Badge>}
                            {req.client.extraBranches > 0 && <Badge variant="outline" className="text-indigo-600"><Building2 className="h-3 w-3 mr-1" />{req.client.extraBranches} sucursal(es)</Badge>}
                        </div>
                    </div>

                    {/* Requested Changes */}
                    <div className="space-y-2 mb-4">
                        {req.requestedPlan && (
                            <p className="text-sm"><span className="text-slate-500">Cambiar a:</span> <strong className="text-violet-600">{req.requestedPlan}</strong></p>
                        )}
                        {req.requestedModules.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                                <span className="text-sm text-slate-500">Módulos:</span>
                                {req.requestedModules.map(mod => {
                                    const info = MODULE_INFO[mod]
                                    const Icon = info?.icon || Package
                                    const tierSuffix = mod === "creditos" && req.requestedCreditTier
                                        ? ` · ${req.requestedCreditTier.replace("TIER_", "Tier ")}`
                                        : ""
                                    return (
                                        <Badge key={mod} variant="outline" className={info?.color}>
                                            <Icon className="h-3 w-3 mr-1" />{(info?.label || mod) + tierSuffix}
                                        </Badge>
                                    )
                                })}
                            </div>
                        )}
                        {req.requestedApiAccess === true && !req.requestedModules.includes("apiAccess") && (
                            <p className="text-sm flex items-center gap-2">
                                <Code className="h-4 w-4 text-emerald-500" />
                                Activar API Access
                            </p>
                        )}
                        {req.requestedExtraBranches > 0 && (
                            <p className="text-sm flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-indigo-500" />
                                {req.requestedExtraBranches} sucursal(es) extra
                            </p>
                        )}
                        {req.extraUsers > 0 && (
                            <p className="text-sm flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-500" />
                                +{req.extraUsers} usuarios
                            </p>
                        )}
                        {req.extraPosStations > 0 && (
                            <p className="text-sm flex items-center gap-2">
                                <MonitorSmartphone className="h-4 w-4 text-green-500" />
                                +{req.extraPosStations} cajas POS
                            </p>
                        )}
                        {req.message && (
                            <p className="text-sm italic text-slate-500">"{req.message}"</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t">
                        <Button
                            onClick={() => handleApprove(req)}
                            disabled={processingId === req.id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                        >
                            {processingId === req.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                            Aprobar
                        </Button>
                        <Button
                            onClick={() => handleReject(req.id)}
                            disabled={processingId === req.id}
                            variant="outline"
                            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Rechazar
                        </Button>
                    </div>
                </Card>
            ))}
        </div>
    )
}
