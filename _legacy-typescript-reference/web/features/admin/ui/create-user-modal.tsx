"use strict";
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2, CreditCard, Users, MonitorSmartphone, Package, Store, Minus, Plus } from "lucide-react"
import { createUserAction } from "@/app/actions/user/create-user.action"
import { PLAN_OPTIONS } from "@/lib/constants/plans"

interface CreateUserModalProps {
  // organizations prop no longer needed for new flow, but keeping for compatibility if passed
  // We might want to switch between "New Org" and "Existing Org" later, but requirement is "New Registration Name"
  organizations?: any[]
  isOpen: boolean
  onClose: () => void
}

export function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    organizationName: "",
    organizationRuc: "",
    planType: "CRECIMIENTO",
    inventoryEnabled: false,
    posEnabled: false,
    maxUsers: 3,
    maxPosStations: 1,
    isActive: true,
  })

  // Determine current plan details for defaults
  const currentPlan = PLAN_OPTIONS.find(p => p.value === formData.planType) || PLAN_OPTIONS[0]

  // Update limits when plan changes
  useEffect(() => {
    const plan = PLAN_OPTIONS.find(p => p.value === formData.planType)
    if (plan) {
      setFormData(prev => ({
        ...prev,
        maxUsers: plan.maxUsers, // Resetting to plan defaults is cleaner for creation flow
        maxPosStations: plan.maxPosStations
      }))
    }
  }, [formData.planType])


  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Prepare payload
      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        organizationName: formData.organizationName,
        organizationRuc: formData.organizationRuc || undefined,
        planType: formData.planType as any,
        inventoryEnabled: formData.inventoryEnabled,
        posEnabled: formData.posEnabled,
        maxUsers: formData.maxUsers,
        maxPosStations: formData.maxPosStations,
      }

      const result = await createUserAction(payload)

      if (!result.success) {
        throw new Error(result.error || "Error al crear usuario")
      }

      // Reset form
      setFormData({
        name: "",
        email: "",
        password: "",
        organizationName: "",
        organizationRuc: "",
        planType: "CRECIMIENTO",
        inventoryEnabled: false,
        posEnabled: false,
        maxUsers: 3,
        maxPosStations: 1,
        isActive: true,
      })

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
    maxUsers: Math.max(1, prev.maxUsers - 1)
  }))
  const incrementStations = () => setFormData(prev => ({ ...prev, maxPosStations: prev.maxPosStations + 1 }))
  const decrementStations = () => setFormData(prev => ({
    ...prev,
    maxPosStations: Math.max(1, prev.maxPosStations - 1)
  }))


  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-hide">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Registrar Nuevo Cliente</h2>
              <p className="text-sm text-gray-500">Crea una organización y su usuario administrador</p>
            </div>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User Details */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 border-b pb-2">Datos del Usuario</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="juan@empresa.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="******"
                  />
                </div>
              </div>

              {/* Organization Details */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 border-b pb-2">Datos de Organización</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre del Negocio
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.organizationName}
                    onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Mi Empresa S.A."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    RUC (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.organizationRuc}
                    onChange={(e) => setFormData({ ...formData, organizationRuc: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="8-888-8888"
                  />
                </div>
              </div>
            </div>

            {/* Plan & Modules */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
                Plan y Módulos
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Seleccionar Plan
                  </label>
                  <select
                    value={formData.planType}
                    onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    {PLAN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} {option.price > 0 ? `($${option.price}/mes)` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Incluye {currentPlan.maxUsers} usuarios y {currentPlan.maxPosStations} caja(s).
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Módulos Adicionales
                  </label>

                  {/* Modules Toggles - Simplified */}
                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center">
                      <Store className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-sm">POS Enabled</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.posEnabled}
                      onChange={(e) => setFormData({ ...formData, posEnabled: e.target.checked })}
                      className="h-4 w-4 bg-blue-600"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center">
                      <Package className="h-4 w-4 text-purple-500 mr-2" />
                      <span className="text-sm">Inventory Enabled</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.inventoryEnabled}
                      onChange={(e) => setFormData({ ...formData, inventoryEnabled: e.target.checked })}
                      className="h-4 w-4 bg-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* Limits Overrides */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium block">Límite Usuarios</label>
                    <span className="text-xs text-gray-500">Max usuarios activos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={decrementUsers} className="p-1 bg-white rounded shadow hover:bg-gray-100">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center font-bold">{formData.maxUsers}</span>
                    <button type="button" onClick={incrementUsers} className="p-1 bg-white rounded shadow hover:bg-gray-100">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium block">Límite Cajas</label>
                    <span className="text-xs text-gray-500">Sesiones POS simultáneas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={decrementStations} className="p-1 bg-white rounded shadow hover:bg-gray-100">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center font-bold">{formData.maxPosStations}</span>
                    <button type="button" onClick={incrementStations} className="p-1 bg-white rounded shadow hover:bg-gray-100">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 z-10 pb-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900/30 transition-colors"
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Crear Cliente"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

