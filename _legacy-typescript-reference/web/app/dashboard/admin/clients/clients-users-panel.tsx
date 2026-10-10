"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Building2, Users, CheckCircle, XCircle, Search,
  ExternalLink, Link2, Key, Copy, CheckCheck, QrCode, X, Package
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

// Módulos binarios (toggle on/off). Créditos se renderiza aparte para
// poder mostrar el tier y reflejar el estado real del gate (creditosEnabled
// AND motorCreditTier asignado).
const MODULE_BADGES: { key: Exclude<keyof Pick<Client, "facturacionEnabled" | "inventoryEnabled" | "posEnabled" | "paydayEnabled" | "logisticsEnabled">, never>; label: string; color: string }[] = [
  { key: "facturacionEnabled", label: "Facturación", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  { key: "inventoryEnabled",   label: "Inventario",  color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" },
  { key: "posEnabled",         label: "POS",         color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" },
  { key: "paydayEnabled",      label: "Nómina",      color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300" },
  { key: "logisticsEnabled",   label: "Logística",   color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" },
]

type CreditTier = "TIER_1" | "TIER_2" | "TIER_3"

interface Client {
  id: string
  name: string
  ruc: string | null
  isActive: boolean
  facturacionEnabled: boolean
  inventoryEnabled: boolean
  posEnabled: boolean
  paydayEnabled: boolean
  logisticsEnabled: boolean
  creditosEnabled: boolean
  motorCreditTier: CreditTier | null
  createdAt: Date
  _count: { users: number }
}

interface User {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: Date | null
  client: { id: string; name: string } | null
}

interface ResetLinkState {
  url: string
  expiresAt: string
  userName: string
  showQR: boolean
  copied: boolean
}

export function ClientsAndUsersPanel({
  clients,
  users,
  initialTab = "clients",
}: {
  clients: Client[]
  users: User[]
  initialTab?: "clients" | "users"
}) {
  const [tab, setTab] = useState<"clients" | "users">(initialTab)
  const [search, setSearch] = useState("")
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null)
  const [resetLink, setResetLink] = useState<ResetLinkState | null>(null)

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.ruc && c.ruc.includes(search))
  )

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.client?.name ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    totalClients: clients.length,
    activeClients: clients.filter((c) => c.isActive).length,
    withModules: clients.filter((c) =>
      c.facturacionEnabled || c.inventoryEnabled || c.posEnabled || c.paydayEnabled || c.logisticsEnabled || (c.creditosEnabled && c.motorCreditTier !== null)
    ).length,
    totalUsers: users.filter((u) => u.role === "CLIENT").length,
    activeUsers: users.filter((u) => u.role === "CLIENT" && u.isActive).length,
  }

  const handleGenerateResetLink = async (user: User) => {
    setLoadingUserId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/generate-reset-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "PASSWORD_RESET", sendEmailToUser: false }),
      })
      const data = await res.json()
      if (res.ok) {
        setResetLink({ url: data.url, expiresAt: data.expiresAt, userName: user.name, showQR: false, copied: false })
      } else {
        alert(data.error || "Error al generar enlace")
      }
    } finally {
      setLoadingUserId(null)
    }
  }

  const handleCopy = () => {
    if (!resetLink) return
    navigator.clipboard.writeText(resetLink.url)
    setResetLink((r) => r ? { ...r, copied: true } : r)
    setTimeout(() => setResetLink((r) => r ? { ...r, copied: false } : r), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel de Administración</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gestión de clientes, usuarios, módulos y soporte
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Clientes",        value: stats.totalClients,  icon: Building2,   color: "text-indigo-600 dark:text-indigo-400" },
          { label: "Activos",         value: stats.activeClients, icon: CheckCircle, color: "text-green-600 dark:text-green-400" },
          { label: "Con módulos",     value: stats.withModules,   icon: Package,     color: "text-blue-600 dark:text-blue-400" },
          { label: "Usuarios",        value: stats.totalUsers,    icon: Users,       color: "text-violet-600 dark:text-violet-400" },
          { label: "Usuarios activos",value: stats.activeUsers,   icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className={`flex items-center gap-1.5 text-xs ${color} mb-1`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          {/* Tabs */}
          <nav className="flex gap-1">
            <button
              onClick={() => setTab("clients")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === "clients"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" /> Clientes
              </span>
            </button>
            <button
              onClick={() => setTab("users")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === "users"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Usuarios
              </span>
            </button>
          </nav>

          {/* Search */}
          <div className="flex-1 md:ml-auto md:max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "clients" ? "Buscar por nombre o RUC…" : "Buscar por nombre, email o empresa…"}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Clients table */}
        {tab === "clients" && (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  {["Cliente", "Módulos activos", "Usuarios", "Estado", "Creado"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredClients.map((client) => {
                  const activeModules = MODULE_BADGES.filter((m) => client[m.key] === true)
                  const creditosActive = client.creditosEnabled && client.motorCreditTier !== null
                  const hasAnyBadge = activeModules.length > 0 || creditosActive
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/admin/clients/${client.id}`} className="group">
                          <div className="flex items-center gap-1 font-medium text-sm text-blue-600 dark:text-blue-400 group-hover:underline">
                            {client.name}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {client.ruc && <div className="text-xs text-gray-400">RUC {client.ruc}</div>}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        {hasAnyBadge ? (
                          <div className="flex flex-wrap gap-1">
                            {activeModules.map((m) => (
                              <span key={m.key} className={`text-xs px-1.5 py-0.5 rounded ${m.color}`}>
                                {m.label}
                              </span>
                            ))}
                            {creditosActive && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                                Créditos · Tier {client.motorCreditTier!.replace("TIER_", "")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">Sin módulos</span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {client._count.users}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {client.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                            <CheckCircle className="h-3 w-3" /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            <XCircle className="h-3 w-3" /> Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {new Date(client.createdAt).toLocaleDateString("es-PA", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  )
                })}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No se encontraron clientes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Users table */}
        {tab === "users" && (
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                <tr>
                  {["Usuario", "Empresa", "Estado", "Último login", "Acciones"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{user.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                      {user.role === "SUPER_ADMIN" && (
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Super Admin</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {user.client ? (
                        <Link
                          href={`/dashboard/admin/clients/${user.client.id}`}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {user.client.name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                          <CheckCircle className="h-3 w-3" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <XCircle className="h-3 w-3" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString("es-PA", { year: "numeric", month: "short", day: "numeric" })
                        : "Nunca"}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {user.client && (
                          <Link
                            href={`/dashboard/admin/clients/${user.client.id}?tab=users`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Key className="h-3 w-3" /> Gestionar
                          </Link>
                        )}
                        <button
                          onClick={() => handleGenerateResetLink(user)}
                          disabled={loadingUserId === user.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                        >
                          <Link2 className="h-3 w-3" />
                          {loadingUserId === user.id ? "..." : "Reset link"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No se encontraron usuarios
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reset link modal */}
      {resetLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Reset link — {resetLink.userName}
              </h3>
              <button
                onClick={() => setResetLink(null)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              Expira: {new Date(resetLink.expiresAt).toLocaleString("es-PA")} (24 horas)
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Enlace de restablecimiento
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={resetLink.url}
                  className="flex-1 min-w-0 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono"
                />
                <button
                  onClick={handleCopy}
                  title="Copiar enlace"
                  className="shrink-0 p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                >
                  {resetLink.copied ? (
                    <CheckCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Comparte este enlace directamente con el usuario por WhatsApp, email u otro medio.
              </p>
            </div>

            <button
              onClick={() => setResetLink((r) => r ? { ...r, showQR: !r.showQR } : r)}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              <QrCode className="h-4 w-4" />
              {resetLink.showQR ? "Ocultar código QR" : "Mostrar código QR"}
            </button>

            {resetLink.showQR && (
              <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200">
                <QRCodeSVG value={resetLink.url} size={220} />
                <p className="text-xs text-gray-500 text-center">
                  El usuario escanea este código con la cámara de su teléfono para restablecer su contraseña
                </p>
              </div>
            )}

            <button
              onClick={() => setResetLink(null)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
