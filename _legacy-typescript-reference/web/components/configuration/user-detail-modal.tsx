"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { X, Loader2, Save, Ticket, Mail, User as UserIcon, Shield, Building2 } from "lucide-react"

interface User {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  createdAt: Date
  clientId?: string
  organization?: {
    id: string
    name: string
    ruc: string | null
  } | null
  folioStats?: {
    assigned: number
    consumed: number
  }
  invoiceCount?: number
}

interface UserDetailModalProps {
  user: User | null
  isOpen: boolean
  onClose: () => void
  organizations?: { id: string; name: string; ruc: string | null }[]
  isSuperAdmin?: boolean
}

export function UserDetailModal({ user, isOpen, onClose, organizations = [], isSuperAdmin = false }: UserDetailModalProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'info' | 'folios' | 'historial'>('info')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [folioHistory, setFolioHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Form data for user info
  const [userForm, setUserForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "USER",
    clientId: user?.clientId || "",
    isActive: user?.isActive ?? true,
  })

  // Form data for folios
  const [foliosForm, setFoliosForm] = useState({
    quantity: 10,
    price: 0.06,
    notes: "",
  })

  if (!isOpen || !user) return null

  // Cargar historial de folios cuando se abre la pestaña
  const loadFolioHistory = async () => {
    if (!user.clientId) return
    
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/configuration/users/${user.id}/folio-history`)
      if (response.ok) {
        const data = await response.json()
        setFolioHistory(data.history || [])
      }
    } catch (err) {
      console.error("Error loading folio history:", err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleTabChange = (tab: 'info' | 'folios' | 'historial') => {
    setActiveTab(tab)
    if (tab === 'historial' && folioHistory.length === 0) {
      loadFolioHistory()
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(`/api/configuration/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar usuario")
      }

      setSuccess("✅ Usuario actualizado correctamente")
      setTimeout(() => {
        router.refresh()
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAssignFolios = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      if (!user.clientId) {
        throw new Error("El usuario no tiene una organización asignada")
      }

      const response = await fetch("/api/admin/folios/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: user.clientId,
          userId: user.id,
          quantity: foliosForm.quantity,
          price: foliosForm.price,
          notes: foliosForm.notes,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al asignar folios")
      }

      setSuccess(`✅ ${foliosForm.quantity} folios asignados correctamente`)
      setFoliosForm({ quantity: 10, price: 0.06, notes: "" })
      setTimeout(() => {
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const totalCost = foliosForm.quantity * foliosForm.price

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-hide">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <UserIcon className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {user.name || "Usuario"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:bg-gray-700 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => handleTabChange('info')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'info'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
                }`}
              >
                <UserIcon className="h-4 w-4 inline mr-2" />
                Información
              </button>
              <button
                onClick={() => handleTabChange('historial')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'historial'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
                }`}
              >
                <svg className="h-4 w-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Historial de Folios
              </button>
              {isSuperAdmin && (
                <button
                  onClick={() => handleTabChange('folios')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'folios'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <Ticket className="h-4 w-4 inline mr-2" />
                  Asignar Folios
                </button>
              )}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto scrollbar-hide max-h-[60vh]">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {/* Tab: Información */}
            {activeTab === 'info' && (
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre Completo
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      id="name"
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Juan Pérez"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="usuario@email.com"
                    />
                  </div>
                </div>

                {isSuperAdmin && organizations.length > 0 && (
                  <div>
                    <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Organización
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <select
                        id="clientId"
                        value={userForm.clientId}
                        onChange={(e) => setUserForm({ ...userForm, clientId: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="">Seleccionar organización</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} {org.ruc ? `(${org.ruc})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {isSuperAdmin && (
                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Rol
                    </label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <select
                        id="role"
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      >
                        <option value="CLIENT">Cliente</option>
                        {isSuperAdmin && <option value="SUPER_ADMIN">Super Administrador</option>}
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={userForm.isActive}
                    onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                    Usuario activo
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900/30 transition-colors"
                    disabled={isLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Tab: Asignar Folios */}
            {activeTab === 'folios' && isSuperAdmin && (
              <form onSubmit={handleAssignFolios} className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Asignar folios a:</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{user.name || user.email}</p>
                  {user.organization && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Organización: {user.organization.name}
                    </p>
                  )}
                  {!user.clientId && (
                    <p className="text-xs text-red-600 mt-2">
                      ⚠️ Este usuario no tiene organización asignada
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cantidad de Folios
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    required
                    min={1}
                    max={10000}
                    value={foliosForm.quantity}
                    onChange={(e) => setFoliosForm({ ...foliosForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Mínimo 1, máximo 10,000 folios
                  </p>
                </div>

                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Precio por Folio (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400">$</span>
                    <input
                      type="number"
                      id="price"
                      required
                      min={0}
                      step={0.01}
                      value={foliosForm.price}
                      onChange={(e) => setFoliosForm({ ...foliosForm, price: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Precio actual: $0.06 (6 centavos)
                  </p>
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notas (Opcional)
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={foliosForm.notes}
                    onChange={(e) => setFoliosForm({ ...foliosForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    placeholder="Ej: Asignación mensual de diciembre"
                  />
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Costo Total:</span>
                    <span className="text-2xl font-bold text-indigo-600">
                      ${totalCost.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {foliosForm.quantity} folios × ${foliosForm.price.toFixed(2)} = ${totalCost.toFixed(2)}
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-900/30 transition-colors"
                    disabled={isLoading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !user.clientId}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Asignando...
                      </>
                    ) : (
                      <>
                        <Ticket className="h-4 w-4 mr-2" />
                        Asignar Folios
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Tab: Historial de Folios */}
            {activeTab === 'historial' && (
              <div className="space-y-4">
                {/* Estadísticas Generales */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-xs text-blue-600 font-medium uppercase">Total Comprado</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {user.folioStats?.assigned.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">folios</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-xs text-green-600 font-medium uppercase">Disponibles</p>
                    <p className="text-2xl font-bold text-green-900 mt-1">
                      {((user.folioStats?.assigned || 0) - (user.folioStats?.consumed || 0)).toLocaleString()}
                    </p>
                    <p className="text-xs text-green-600 mt-1">folios</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <p className="text-xs text-red-600 font-medium uppercase">Consumidos</p>
                    <p className="text-2xl font-bold text-red-900 mt-1">
                      {user.folioStats?.consumed.toLocaleString() || 0}
                    </p>
                    <p className="text-xs text-red-600 mt-1">folios</p>
                  </div>
                </div>

                {/* Gasto Total */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Gasto Total en Folios</p>
                      <p className="text-xs text-purple-500 mt-1">Basado en precio promedio de $0.06 por folio</p>
                    </div>
                    <p className="text-3xl font-bold text-purple-900">
                      ${((user.folioStats?.assigned || 0) * 0.06).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* Historial de Asignaciones */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Historial de Asignaciones</h4>
                  
                  {loadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Cargando historial...</span>
                    </div>
                  ) : folioHistory.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
                      {folioHistory.map((item: any, index: number) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {item.assignedAmount.toLocaleString()} folios asignados
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {new Date(item.assignedAt).toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              {item.notes && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">"{item.notes}"</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500 dark:text-gray-400">Consumidos</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {item.consumedAmount.toLocaleString()} / {item.assignedAmount.toLocaleString()}
                              </p>
                              <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-1">
                                <div
                                  className="bg-indigo-600 h-1.5 rounded-full"
                                  style={{
                                    width: `${Math.min((item.consumedAmount / item.assignedAmount) * 100, 100)}%`
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Ticket className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No hay historial de asignaciones</p>
                      <p className="text-xs mt-1">Este usuario aún no tiene folios asignados</p>
                    </div>
                  )}
                </div>

                {/* Estadística de Facturas */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Facturas Emitidas</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total de facturas creadas por este usuario</p>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {user.invoiceCount || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

