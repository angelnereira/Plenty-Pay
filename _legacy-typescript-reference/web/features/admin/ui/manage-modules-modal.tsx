"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2, Package, Store, FileText, CreditCard, Users, MonitorSmartphone, Minus, Plus, Clock, Truck } from "lucide-react"
import { cn } from "@/lib/utils"
import { PLAN_OPTIONS, MODULE_PRICES, ADDON_CATALOG, formatCents } from "@/lib/constants/plans"

interface ManageModulesModalProps {
    user: any // UserWithClient
    isOpen: boolean
    onClose: () => void
}

const EXTRA_POS_STATION_PRICE = MODULE_PRICES.extraPos
const EXTRA_USER_PRICE = MODULE_PRICES.extraUser

export function ManageModulesModal({ user, isOpen, onClose }: ManageModulesModalProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const [formData, setFormData] = useState({
        planType: "START",
        facturacionEnabled: false,
        inventoryEnabled: false,
        posEnabled: false,
        paydayEnabled: false,
        logisticsEnabled: false,
        maxUsers: 3,
        maxPosStations: 1,
    })

    // Get current plan config
    const currentPlan = PLAN_OPTIONS.find(p => p.value === formData.planType) || PLAN_OPTIONS[0]

    // Calculate extra costs
    const extraUsers = Math.max(0, formData.maxUsers - currentPlan.maxUsers)
    const extraStations = Math.max(0, formData.maxPosStations - currentPlan.maxPosStations)
    const extraUsersCost = extraUsers * EXTRA_USER_PRICE
    const extraStationsCost = extraStations * EXTRA_POS_STATION_PRICE
    const inventoryCost = formData.inventoryEnabled ? MODULE_PRICES.inventory : 0
    const posCost = formData.posEnabled ? MODULE_PRICES.pos : 0
    const paydayCost = formData.paydayEnabled ? MODULE_PRICES.payday : 0
    const logisticsCost = formData.logisticsEnabled ? MODULE_PRICES.logistics : 0
    const totalMonthly = currentPlan.price + extraUsersCost + extraStationsCost + inventoryCost + posCost + paydayCost + logisticsCost

    // Cargar datos iniciales cuando se abre el modal o cambia el usuario.
    // Los planes legacy (CRECIMIENTO/PROFESIONAL/EMPRESARIAL) se mapean al
    // nombre nuevo equivalente al cargar el form.
    useEffect(() => {
        if (user?.client) {
            const PLAN_LEGACY: Record<string, string> = {
                CRECIMIENTO: "START",
                PROFESIONAL: "BUSINESS",
                EMPRESARIAL: "BUSINESS",
            }
            const rawPlan = user.client.planType || "START"
            const planType = PLAN_LEGACY[rawPlan] ?? rawPlan
            setFormData({
                planType,
                facturacionEnabled: user.client.facturacionEnabled || false,
                inventoryEnabled: user.client.inventoryEnabled || false,
                posEnabled: user.client.posEnabled || false,
                paydayEnabled: user.client.paydayEnabled || false,
                logisticsEnabled: user.client.logisticsEnabled || false,
                maxUsers: user.client.maxUsers || 3,
                maxPosStations: user.client.maxPosStations || 1,
            })
        }
    }, [user, isOpen])

    // When plan changes, update min limits
    useEffect(() => {
        const plan = PLAN_OPTIONS.find(p => p.value === formData.planType)
        if (plan) {
            setFormData(prev => ({
                ...prev,
                maxUsers: Math.max(prev.maxUsers, plan.maxUsers),
                maxPosStations: Math.max(prev.maxPosStations, plan.maxPosStations),
            }))
        }
    }, [formData.planType])

    if (!isOpen || !user?.client) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const response = await fetch(`/api/admin/organizations/${user.client.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Error al actualizar módulos")
            }

            router.refresh()
            onClose()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    const incrementUsers = () => setFormData(prev => ({ ...prev, maxUsers: prev.maxUsers + 1 }))
    const decrementUsers = () => setFormData(prev => ({
        ...prev,
        maxUsers: Math.max(currentPlan.maxUsers, prev.maxUsers - 1)
    }))
    const incrementStations = () => setFormData(prev => ({ ...prev, maxPosStations: prev.maxPosStations + 1 }))
    const decrementStations = () => setFormData(prev => ({
        ...prev,
        maxPosStations: Math.max(currentPlan.maxPosStations, prev.maxPosStations - 1)
    }))

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-hide">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

                <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
                    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Gestión de Suscripción</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Cliente: {user.client.name}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                                {error}
                            </div>
                        )}

                        {/* Plan Selector */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                                <CreditCard className="h-4 w-4 mr-2 text-blue-500" />
                                Plan de Suscripción
                            </label>
                            <select
                                value={formData.planType}
                                onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            >
                                {PLAN_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label} {option.price > 0 ? `($${option.price}/mes)` : '(Custom)'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* User & POS Limits */}
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Límites de Usuarios y Cajas POS
                            </label>

                            {/* Max Users */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Usuarios Máximos</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Plan incluye {currentPlan.maxUsers} • Extra: +${EXTRA_USER_PRICE}/usuario
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={decrementUsers}
                                        disabled={formData.maxUsers <= currentPlan.maxUsers}
                                        className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 disabled:opacity-50"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </button>
                                    <span className="w-8 text-center font-bold text-lg">{formData.maxUsers}</span>
                                    <button
                                        type="button"
                                        onClick={incrementUsers}
                                        className="p-1 rounded-full bg-gray-200 dark:bg-gray-700"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Max POS Stations */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mr-3">
                                        <MonitorSmartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Cajas POS Simultáneas</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Plan incluye {currentPlan.maxPosStations} • Extra: +${EXTRA_POS_STATION_PRICE}/caja
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={decrementStations}
                                        disabled={formData.maxPosStations <= currentPlan.maxPosStations}
                                        className="p-1 rounded-full bg-gray-200 dark:bg-gray-700 disabled:opacity-50"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </button>
                                    <span className="w-8 text-center font-bold text-lg">{formData.maxPosStations}</span>
                                    <button
                                        type="button"
                                        onClick={incrementStations}
                                        className="p-1 rounded-full bg-gray-200 dark:bg-gray-700"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modules Toggles */}
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Módulos Adicionales
                            </label>

                            {/* Facturación toggle (addon como los demás) */}
                            <div className="flex items-center justify-between p-3 rounded-lg border transition-colors bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <div className="flex items-center">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Facturación electrónica</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            DGI / HKA — incluida en todos los planes
                                        </p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.facturacionEnabled}
                                        onChange={(e) => setFormData({ ...formData, facturacionEnabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* POS Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg border transition-colors bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <div className="flex items-center">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg mr-3">
                                        <Store className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Punto de Venta</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Cajas según el plan (Start 1 / Business 3 / Enterprise 5) + cajas extra
                                        </p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.posEnabled}
                                        onChange={(e) => setFormData({ ...formData, posEnabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Inventory Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg border transition-colors bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <div className="flex items-center">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mr-3">
                                        <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Inventario</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Incluido en el plan (Start básico / Business avanzado)
                                        </p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.inventoryEnabled}
                                        onChange={(e) => setFormData({ ...formData, inventoryEnabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Payday Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg border transition-colors bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <div className="flex items-center">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg mr-3">
                                        <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Nómina</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            $20 base + $5 / empleado activo (dinámico)
                                        </p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.paydayEnabled}
                                        onChange={(e) => setFormData({ ...formData, paydayEnabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Logistics Toggle */}
                            <div className="flex items-center justify-between p-3 rounded-lg border transition-colors bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                <div className="flex items-center">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3">
                                        <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Envíos / Logística</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            +{formatCents(ADDON_CATALOG.logistics.pricing.kind === "fixed" ? ADDON_CATALOG.logistics.pricing.priceCents : 0)}/mes (incluido en Enterprise)
                                        </p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.logisticsEnabled}
                                        onChange={(e) => setFormData({ ...formData, logisticsEnabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>

                        {/* Cost Summary */}
                        <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <h4 className="font-bold text-gray-900 dark:text-white mb-3">Resumen de Costos</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                    <span>Plan {currentPlan.label}</span>
                                    <span>${currentPlan.price.toFixed(2)}</span>
                                </div>
                                {extraUsers > 0 && (
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>+{extraUsers} usuarios extra</span>
                                        <span>+${extraUsersCost.toFixed(2)}</span>
                                    </div>
                                )}
                                {extraStations > 0 && (
                                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>+{extraStations} cajas POS extra</span>
                                        <span>+${extraStationsCost.toFixed(2)}</span>
                                    </div>
                                )}
                                {formData.facturacionEnabled && (
                                    <div className="flex justify-between text-blue-600 dark:text-blue-400">
                                        <span>Facturación electrónica</span>
                                        <span>incluida en plan</span>
                                    </div>
                                )}
                                {formData.inventoryEnabled && (
                                    <div className="flex justify-between text-purple-600 dark:text-purple-400">
                                        <span>Inventario</span>
                                        <span>incluido en plan</span>
                                    </div>
                                )}
                                {formData.posEnabled && (
                                    <div className="flex justify-between text-green-600 dark:text-green-400">
                                        <span>Punto de Venta</span>
                                        <span>incluido en plan</span>
                                    </div>
                                )}
                                {formData.paydayEnabled && (
                                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                        <span>Nómina (dinámica)</span>
                                        <span>$20 + $5/empleado</span>
                                    </div>
                                )}
                                {formData.logisticsEnabled && (
                                    <div className="flex justify-between text-blue-600 dark:text-blue-400">
                                        <span>Envíos / Logística</span>
                                        <span>+{formatCents(ADDON_CATALOG.logistics.pricing.kind === "fixed" ? ADDON_CATALOG.logistics.pricing.priceCents : 0)}</span>
                                    </div>
                                )}
                                <div className="border-t border-slate-300 dark:border-slate-700 pt-2 mt-2">
                                    <div className="flex justify-between font-bold text-lg text-gray-900 dark:text-white">
                                        <span>Total Mensual</span>
                                        <span>${totalMonthly.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                disabled={isLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    "Guardar Cambios"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
