"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface Client {
  id: string
  name: string
  ruc: string | null
  dv: string | null
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  isActive: boolean
  suspendedAt: Date | null
  suspendReason: string | null
}

interface ClientInfoPanelProps {
  client: Client
}

export function ClientInfoPanel({ client }: ClientInfoPanelProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [form, setForm] = useState({
    name:    client.name,
    ruc:     client.ruc    ?? "",
    dv:      client.dv     ?? "",
    email:   client.email  ?? "",
    phone:   client.phone  ?? "",
    address: client.address ?? "",
    website: client.website ?? "",
  })

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const res = await fetch(`/api/admin/organizations/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Error al guardar")
      } else {
        setSuccess("Guardado correctamente")
        router.refresh()
      }
    } catch {
      setError("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (action: "suspend" | "activate") => {
    const confirmMsg = {
      suspend:  "¿Suspender este cliente? Todos sus usuarios perderán acceso.",
      activate: "¿Reactivar este cliente?",
    }[action]

    if (!confirm(confirmMsg)) return

    setSaving(true)
    setError("")
    setSuccess("")

    try {
      const body = { isActive: action === "activate" }
      const res = await fetch(`/api/admin/organizations/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Error al cambiar estado")
      } else {
        setSuccess("Estado actualizado")
        router.refresh()
      }
    } catch {
      setError("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800 text-sm text-red-800 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Status management */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado:</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              client.isActive
                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-400"
            }`}>
              {client.isActive ? "Activo" : "Inactivo"}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {client.isActive ? (
              <button
                onClick={() => handleStatusChange("suspend")}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
              >
                <AlertTriangle className="h-3 w-3" /> Suspender
              </button>
            ) : (
              <button
                onClick={() => handleStatusChange("activate")}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className="h-3 w-3" /> Reactivar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: "Nombre", field: "name" as const, required: true },
          { label: "RUC",    field: "ruc"  as const },
          { label: "DV",     field: "dv"   as const },
          { label: "Email",  field: "email" as const },
          { label: "Teléfono", field: "phone" as const },
          { label: "Dirección", field: "address" as const },
          { label: "Sitio web", field: "website" as const },
        ].map(({ label, field, required }) => (
          <div key={field} className={field === "address" || field === "website" ? "md:col-span-2" : ""}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={form[field]}
              onChange={(e) => update(field, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  )
}
