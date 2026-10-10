"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X, LogIn, Link2, Key, Trash2, QrCode, Copy, CheckCheck, Mail } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

interface ClientUser {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

interface ClientUsersPanelProps {
  clientId: string
  users: ClientUser[]
}

interface ResetLinkModal {
  userId: string
  userName: string
  url: string
  expiresAt: string
}

interface CreateUserForm {
  name: string
  email: string
  password: string
}

export function ClientUsersPanel({ clientId, users: initialUsers }: ClientUsersPanelProps) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [resetLinkModal, setResetLinkModal] = useState<ResetLinkModal | null>(null)
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserForm>({ name: "", email: "", password: "" })
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState("")
  const [changePasswordModal, setChangePasswordModal] = useState<{ userId: string; userName: string } | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)

  const handleToggleActive = async (user: ClientUser) => {
    if (!confirm(`¿${user.isActive ? "Desactivar" : "Activar"} a ${user.name}?`)) return
    setLoadingId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u))
        )
        router.refresh()
      }
    } finally {
      setLoadingId(null)
      setActiveMenu(null)
    }
  }

  const handleImpersonate = async (user: ClientUser) => {
    if (!confirm(`¿Iniciar sesión como ${user.name}?`)) return
    setLoadingId(user.id)
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
        alert("Error: " + (data.error || "No se pudo iniciar impersonation"))
      }
    } finally {
      setLoadingId(null)
      setActiveMenu(null)
    }
  }

  const handleGenerateResetLink = async (user: ClientUser) => {
    setLoadingId(user.id)
    setActiveMenu(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/generate-reset-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PASSWORD_RESET", sendEmailToUser: false }),
      })
      const data = await res.json()
      if (res.ok) {
        setResetLinkModal({ userId: user.id, userName: user.name, url: data.url, expiresAt: data.expiresAt })
        setShowQR(false)
        setCopied(false)
      } else {
        alert(data.error || "Error al generar enlace")
      }
    } finally {
      setLoadingId(null)
    }
  }

  const handleSendResetEmail = async () => {
    if (!resetLinkModal) return
    setLoadingId(resetLinkModal.userId)
    try {
      await fetch(`/api/admin/users/${resetLinkModal.userId}/generate-reset-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PASSWORD_RESET", sendEmailToUser: true }),
      })
      alert("Email enviado")
    } finally {
      setLoadingId(null)
    }
  }

  const handleCopyLink = () => {
    if (!resetLinkModal) return
    navigator.clipboard.writeText(resetLinkModal.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleChangePassword = async () => {
    if (!changePasswordModal) return
    if (newPassword.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.")
      return
    }
    setPasswordLoading(true)
    setPasswordError("")
    try {
      const res = await fetch(`/api/admin/users/${changePasswordModal.userId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPasswordError(data.error || "Error al cambiar contraseña")
      } else {
        setChangePasswordModal(null)
        setNewPassword("")
        alert("Contraseña actualizada")
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleCreateUser = async () => {
    setCreateLoading(true)
    setCreateError("")
    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createForm, clientId, role: "CLIENT", isActive: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCreateError(data.error || "Error al crear usuario")
      } else {
        setShowCreateModal(false)
        setCreateForm({ name: "", email: "", password: "" })
        router.refresh()
      }
    } finally {
      setCreateLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{users.length} usuario(s)</p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Crear usuario
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-hide rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usuario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Último login</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{user.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {user.isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <Check className="h-3 w-3" /> Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                      <X className="h-3 w-3" /> Inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString("es-PA", { year: "numeric", month: "short", day: "numeric" })
                    : "Nunca"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setActiveMenu(activeMenu === user.id ? null : user.id)}
                      disabled={loadingId === user.id}
                      className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
                    >
                      {loadingId === user.id ? "..." : "Acciones"}
                    </button>

                    {activeMenu === user.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
                        <div className="absolute right-0 mt-1 w-52 rounded-xl shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-gray-700 z-20 border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <div className="py-1">
                            <button
                              onClick={() => { setActiveMenu(null); setChangePasswordModal({ userId: user.id, userName: user.name }); setNewPassword(""); setPasswordError("") }}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Key className="h-4 w-4 mr-2" /> Cambiar contraseña
                            </button>
                            <button
                              onClick={() => handleGenerateResetLink(user)}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Link2 className="h-4 w-4 mr-2" /> Generar reset link
                            </button>
                            <button
                              onClick={() => handleImpersonate(user)}
                              className="flex items-center w-full px-4 py-2 text-sm text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            >
                              <LogIn className="h-4 w-4 mr-2" /> Impersonar
                            </button>
                            <button
                              onClick={() => handleToggleActive(user)}
                              className={`flex items-center w-full px-4 py-2 text-sm ${user.isActive ? "text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20" : "text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"}`}
                            >
                              {user.isActive ? <X className="h-4 w-4 mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                              {user.isActive ? "Desactivar" : "Activar"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No hay usuarios en este cliente
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reset link modal */}
      {resetLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Reset link para {resetLinkModal.userName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Expira: {new Date(resetLinkModal.expiresAt).toLocaleString("es-PA")}
            </p>

            {/* URL */}
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={resetLinkModal.url}
                className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              />
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
              >
                {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            {/* QR toggle */}
            <button
              onClick={() => setShowQR((v) => !v)}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <QrCode className="h-4 w-4" />
              {showQR ? "Ocultar" : "Mostrar"} código QR
            </button>

            {showQR && (
              <div className="flex justify-center p-4 bg-white rounded-xl border border-gray-200">
                <QRCodeSVG value={resetLinkModal.url} size={200} />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSendResetEmail}
                disabled={loadingId === resetLinkModal.userId}
                className="flex items-center gap-2 flex-1 justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <Mail className="h-4 w-4" /> Enviar por email
              </button>
              <button
                onClick={() => setResetLinkModal(null)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {changePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Cambiar contraseña — {changePasswordModal.userName}
            </h3>
            {passwordError && (
              <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setChangePasswordModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {passwordLoading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Crear usuario</h3>
            {createError && (
              <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
            )}
            <div className="space-y-3">
              {(["name", "email", "password"] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">
                    {field === "name" ? "Nombre" : field === "email" ? "Email" : "Contraseña"}
                  </label>
                  <input
                    type={field === "password" ? "password" : field === "email" ? "email" : "text"}
                    value={createForm[field]}
                    onChange={(e) => setCreateForm((p) => ({ ...p, [field]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={field === "password" ? "Mínimo 8 caracteres" : ""}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowCreateModal(false); setCreateError("") }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateUser}
                disabled={createLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {createLoading ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
