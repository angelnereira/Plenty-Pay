"use client"

import { useState } from "react"
import { Users as UsersIcon, Plus, Trash2, Mail, Shield, CheckCircle, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { UserDetailModal } from "./user-detail-modal"

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

interface UsersManagementProps {
  users: User[]
  clientId: string
  organizations?: { id: string; name: string; ruc: string | null }[]
  isSuperAdmin?: boolean
}

export function UsersManagement({ users, clientId, organizations = [], isSuperAdmin = false }: UsersManagementProps) {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleCreateUser = () => {
    setSelectedUser(null)
    setShowModal(true)
  }

  const handleUserClick = (user: User) => {
    setSelectedUser(user)
    setShowModal(true)
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/configuration/users/${userId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Error al eliminar usuario")
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/configuration/users/${userId}/toggle`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Error al cambiar estado del usuario")
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UsersIcon className="h-6 w-6 text-indigo-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Gestión de Usuarios
            </h2>
            <p className="text-sm text-gray-600">
              Administra los usuarios y sus permisos
            </p>
          </div>
        </div>
        <button
          onClick={handleCreateUser}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Folios
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Facturas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr 
                key={user.id} 
                onClick={() => handleUserClick(user)}
                className="hover:bg-indigo-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-medium text-sm">
                        {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.name || "Sin nombre"}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <Mail className="h-3 w-3 mr-1" />
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === "SUPER_ADMIN"
                        ? "bg-purple-100 text-purple-800"
                        : user.role === "CLIENT"
                        ? "bg-indigo-100 text-indigo-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.folioStats ? (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {(user.folioStats.assigned - user.folioStats.consumed).toLocaleString()} disponibles
                      </span>
                      <span className="text-xs text-gray-500">
                        {user.folioStats.consumed.toLocaleString()} consumidos de {user.folioStats.assigned.toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Sin datos</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{user.invoiceCount || 0}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.isActive ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <XCircle className="h-3 w-3 mr-1" />
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteUser(user.id)
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      disabled={isLoading}
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Usuarios</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
            <UsersIcon className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Activos</p>
              <p className="text-2xl font-bold text-green-600">
                {users.filter((u) => u.isActive).length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Inactivos</p>
              <p className="text-2xl font-bold text-red-600">
                {users.filter((u) => !u.isActive).length}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      <UserDetailModal
        user={selectedUser}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setSelectedUser(null)
        }}
        organizations={organizations}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  )
}

