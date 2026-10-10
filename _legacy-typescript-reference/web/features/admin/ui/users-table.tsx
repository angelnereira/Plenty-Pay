"use client"

import { useState } from "react"
import { User } from "@prisma/client"
import {
  MoreVertical, Edit, Trash2, Package, Store, FileText, CreditCard,
  LogIn, Search, Mail, KeyRound, ShieldCheck, Clock, Send, Briefcase,
  CalendarDays, Wallet,
} from "lucide-react"
import { EditUserModal } from "./edit-user-modal"
import { DeleteUserModal } from "./delete-user-modal"
import { ManageModulesModal } from "./manage-modules-modal"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type UserWithClient = User & {
  client: {
    id: string
    name: string
    ruc: string | null
    inventoryEnabled: boolean
    posEnabled: boolean
    paydayEnabled: boolean
    logisticsEnabled: boolean
    planType: string
    approvalStatus: string
    isActive: boolean
    demoStartDate: Date | null
    demoEndDate: Date | null
  } | null
}

interface UsersTableProps {
  users: UserWithClient[]
  organizations: { id: string; name: string; ruc: string | null }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  UNVERIFIED: { label: "Sin Verificar", color: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" },
  SETUP_PENDING: { label: "Config. Pendiente", color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300" },
  PENDING_ONBOARDING: { label: "En Onboarding", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300" },
  PENDING_APPROVAL: { label: "Esperando Aprobación", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300" },
  ACTIVE: { label: "Activo", color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" },
  SUSPENDED: { label: "Suspendido", color: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300" },
  DEACTIVATED: { label: "Desactivado", color: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300" },
}

const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  CRECIMIENTO: { label: "Crecimiento", color: "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300" },
  PROFESIONAL: { label: "Profesional", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  EMPRESARIAL: { label: "Empresarial", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" },
  ENTERPRISE: { label: "Enterprise", color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" },
}

function getTrialStatus(client: UserWithClient["client"]) {
  if (!client?.demoEndDate) return null
  const now = new Date()
  const end = new Date(client.demoEndDate)
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysLeft <= 0) return { label: "Trial Expirado", color: "text-red-600 dark:text-red-400", daysLeft: 0 }
  if (daysLeft <= 3) return { label: `Trial: ${daysLeft}d`, color: "text-orange-600 dark:text-orange-400", daysLeft }
  return { label: `Trial: ${daysLeft}d`, color: "text-blue-600 dark:text-blue-400", daysLeft }
}

function formatRelativeTime(date: Date | null | undefined) {
  if (!date) return "Nunca"
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "Justo ahora"
  if (diffMin < 60) return `Hace ${diffMin}m`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `Hace ${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `Hace ${diffDays}d`
  return d.toLocaleDateString("es-PA", { month: "short", day: "numeric" })
}

export function UsersTable({ users, organizations }: UsersTableProps) {
  const router = useRouter()
  const [selectedUser, setSelectedUser] = useState<UserWithClient | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [manageModulesModalOpen, setManageModulesModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("ALL")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)

  const handleEdit = (user: UserWithClient) => {
    setSelectedUser(user)
    setEditModalOpen(true)
    setActiveMenu(null)
  }

  const handleDelete = (user: UserWithClient) => {
    setSelectedUser(user)
    setDeleteModalOpen(true)
    setActiveMenu(null)
  }

  const handleManageModules = (user: UserWithClient) => {
    setSelectedUser(user)
    setManageModulesModalOpen(true)
    setActiveMenu(null)
  }

  const handleImpersonate = async (user: UserWithClient) => {
    if (!confirm(`¿Iniciar sesión como ${user.name}?`)) return
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl
      } else {
        toast.error(data.error || "Error en impersonation")
      }
    } catch {
      toast.error("Error de conexión")
    }
    setActiveMenu(null)
  }

  const handleSendEmail = async (userId: string, type: "activation" | "reset-password" | "verification") => {
    setSendingEmail(`${userId}-${type}`)
    setActiveMenu(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || "Correo enviado exitosamente")
      } else {
        toast.error(data.error || "Error al enviar correo")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSendingEmail(null)
    }
  }

  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch = !q ||
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.client?.ruc?.toLowerCase().includes(q) ||
      user.client?.name?.toLowerCase().includes(q)

    const matchesRole = roleFilter === "ALL" || user.role === roleFilter
    const matchesStatus =
      statusFilter === "ALL" ||
      user.status === statusFilter ||
      (statusFilter === "INACTIVE" && !user.isActive)

    return matchesSearch && matchesRole && matchesStatus
  })

  return (
    <>
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email, RUC u organización..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">Todos los Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="CLIENT">Cliente</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="ACTIVE">Activos</option>
              <option value="UNVERIFIED">Sin Verificar</option>
              <option value="SETUP_PENDING">Config. Pendiente</option>
              <option value="PENDING_ONBOARDING">En Onboarding</option>
              <option value="PENDING_APPROVAL">Esperando Aprobación</option>
              <option value="SUSPENDED">Suspendidos</option>
              <option value="DEACTIVATED">Desactivados</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Organización
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Plan / Módulos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Último Acceso
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  No se encontraron usuarios con los filtros aplicados
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const statusCfg = STATUS_CONFIG[user.status] || STATUS_CONFIG.ACTIVE
                const planCfg = user.client ? PLAN_CONFIG[user.client.planType] || PLAN_CONFIG.CRECIMIENTO : null
                const trial = getTrialStatus(user.client)

                return (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    {/* User info */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            {user.name?.charAt(0) || "U"}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                          {user.role === "SUPER_ADMIN" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 mt-0.5">
                              SUPER ADMIN
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Organization */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.client ? (
                        <div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">{user.client.name}</div>
                          {user.client.ruc && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{user.client.ruc}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        {trial && (
                          <div className={`text-xs font-medium ${trial.color} flex items-center gap-1`}>
                            <CalendarDays className="h-3 w-3" />
                            {trial.label}
                          </div>
                        )}
                        {user.client && !user.client.isActive && user.status === "ACTIVE" && (
                          <div className="text-xs text-orange-600 dark:text-orange-400">Org. inactiva</div>
                        )}
                      </div>
                    </td>

                    {/* Plan & Modules */}
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {planCfg && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${planCfg.color}`}>
                            <Wallet className="h-3 w-3 mr-1" />
                            {planCfg.label}
                          </span>
                        )}
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                            <FileText className="h-2.5 w-2.5 mr-0.5" />Fact
                          </span>
                          {user.client?.inventoryEnabled && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400">
                              <Package className="h-2.5 w-2.5 mr-0.5" />Inv
                            </span>
                          )}
                          {user.client?.posEnabled && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                              <Store className="h-2.5 w-2.5 mr-0.5" />POS
                            </span>
                          )}
                          {user.client?.paydayEnabled && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                              <Briefcase className="h-2.5 w-2.5 mr-0.5" />Pay
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Last login */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {formatRelativeTime(user.lastLoginAt)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {user.createdAt ? `Reg: ${new Date(user.createdAt).toLocaleDateString("es-PA", { month: "short", day: "numeric", year: "2-digit" })}` : ""}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative">
                        <button
                          onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-colors"
                        >
                          <MoreVertical className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        </button>

                        {activeMenu === user.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                            <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black dark:ring-gray-700 ring-opacity-5 z-20 border border-gray-200 dark:border-gray-700">
                              <div className="py-1">
                                {/* Edit */}
                                <button
                                  onClick={() => handleEdit(user)}
                                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Editar Usuario
                                </button>

                                {/* Impersonate */}
                                <button
                                  onClick={() => handleImpersonate(user)}
                                  className="flex items-center w-full px-4 py-2 text-sm text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                >
                                  <LogIn className="h-4 w-4 mr-2" />
                                  Log In como Usuario
                                </button>

                                {/* Manage subscription */}
                                <button
                                  onClick={() => handleManageModules(user)}
                                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Gestionar Suscripción
                                </button>

                                {/* Divider */}
                                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

                                {/* Email: Activation */}
                                <button
                                  onClick={() => handleSendEmail(user.id, "activation")}
                                  disabled={sendingEmail === `${user.id}-activation`}
                                  className="flex items-center w-full px-4 py-2 text-sm text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                                >
                                  <Mail className="h-4 w-4 mr-2" />
                                  {sendingEmail === `${user.id}-activation` ? "Enviando..." : "Enviar Correo de Activación"}
                                </button>

                                {/* Email: Reset Password */}
                                <button
                                  onClick={() => handleSendEmail(user.id, "reset-password")}
                                  disabled={sendingEmail === `${user.id}-reset-password`}
                                  className="flex items-center w-full px-4 py-2 text-sm text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                                >
                                  <KeyRound className="h-4 w-4 mr-2" />
                                  {sendingEmail === `${user.id}-reset-password` ? "Enviando..." : "Enviar Reset de Contraseña"}
                                </button>

                                {/* Email: Verification */}
                                <button
                                  onClick={() => handleSendEmail(user.id, "verification")}
                                  disabled={sendingEmail === `${user.id}-verification`}
                                  className="flex items-center w-full px-4 py-2 text-sm text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50"
                                >
                                  <ShieldCheck className="h-4 w-4 mr-2" />
                                  {sendingEmail === `${user.id}-verification` ? "Enviando..." : "Reenviar Verificación"}
                                </button>

                                {/* Divider */}
                                {user.role !== "SUPER_ADMIN" && (
                                  <>
                                    <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                                    <button
                                      onClick={() => handleDelete(user)}
                                      className="flex items-center w-full px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar Usuario
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {selectedUser && (
        <>
          <EditUserModal
            user={selectedUser}
            organizations={organizations}
            isOpen={editModalOpen}
            onClose={() => {
              setEditModalOpen(false)
              setSelectedUser(null)
            }}
          />

          <DeleteUserModal
            user={selectedUser}
            isOpen={deleteModalOpen}
            onClose={() => {
              setDeleteModalOpen(false)
              setSelectedUser(null)
            }}
          />

          <ManageModulesModal
            user={selectedUser}
            isOpen={manageModulesModalOpen}
            onClose={() => {
              setManageModulesModalOpen(false)
              setSelectedUser(null)
            }}
          />
        </>
      )}
    </>
  )
}
