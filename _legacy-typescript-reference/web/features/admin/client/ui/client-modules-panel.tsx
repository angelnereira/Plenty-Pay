"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Package, Store, DollarSign, Truck, CreditCard, Info, Code, Building2, MessageCircle, Headphones, BarChart3, Brain } from "lucide-react"
import { ADDON_CATALOG, formatCents } from "@/lib/constants/plans"

type CreditTier = "TIER_1" | "TIER_2" | "TIER_3"

interface Client {
  id: string
  maxUsers: number
  maxPosStations: number
  maxBranches: number
  extraBranches: number
  facturacionEnabled: boolean
  inventoryEnabled: boolean
  posEnabled: boolean
  paydayEnabled: boolean
  logisticsEnabled: boolean
  creditosEnabled: boolean
  motorCreditTier: CreditTier | null
  apiAccessEnabled: boolean
  whatsappEnabled: boolean
  premiumSupportEnabled: boolean
  biEnabled: boolean
  biProEnabled: boolean
}

interface ClientModulesPanelProps {
  client: Client
}

const MODULES = [
  {
    key: "facturacionEnabled" as const,
    label: "Facturación electrónica",
    description: "Emisión de facturas electrónicas DGI, gestión de folios y clientes",
    icon: FileText,
    color: "text-blue-500",
  },
  {
    key: "inventoryEnabled" as const,
    label: "Inventario",
    description: "Control de stock, productos, proveedores y órdenes de compra",
    icon: Package,
    color: "text-purple-500",
  },
  {
    key: "posEnabled" as const,
    label: "Punto de Venta (POS)",
    description: "Caja registradora, sesiones de venta y cierre de caja",
    icon: Store,
    color: "text-green-500",
  },
  {
    key: "paydayEnabled" as const,
    label: "Nómina (Payday)",
    description: "Gestión de empleados, planillas y cálculo de nómina",
    icon: DollarSign,
    color: "text-yellow-500",
  },
  {
    key: "logisticsEnabled" as const,
    label: "Logística y Envíos",
    description: "Órdenes de entrega, conductores, transportistas y rutas",
    icon: Truck,
    color: "text-orange-500",
  },
  {
    key: "apiAccessEnabled" as const,
    label: "API Access",
    description: "Endpoints REST + webhooks para integraciones externas",
    icon: Code,
    color: "text-emerald-500",
  },
  {
    key: "whatsappEnabled" as const,
    label: ADDON_CATALOG.whatsapp.label,
    description: ADDON_CATALOG.whatsapp.description,
    icon: MessageCircle,
    color: "text-green-600",
  },
  {
    key: "premiumSupportEnabled" as const,
    label: ADDON_CATALOG.premiumSupport.label,
    description: ADDON_CATALOG.premiumSupport.description,
    icon: Headphones,
    color: "text-indigo-500",
  },
  {
    key: "biEnabled" as const,
    label: ADDON_CATALOG.bi.label,
    description: ADDON_CATALOG.bi.description,
    icon: BarChart3,
    color: "text-violet-500",
  },
  {
    key: "biProEnabled" as const,
    label: ADDON_CATALOG.biPro.label,
    description: ADDON_CATALOG.biPro.description,
    icon: Brain,
    color: "text-purple-500",
  },
]

// Tier options derivados del catálogo único.
const TIER_OPTIONS: { value: CreditTier; label: string; price: string }[] =
  ADDON_CATALOG.creditos.pricing.kind === "tiered"
    ? (["TIER_1", "TIER_2", "TIER_3"] as const).map((t) => {
        const tier = ADDON_CATALOG.creditos.pricing.kind === "tiered"
          ? ADDON_CATALOG.creditos.pricing.tiers[t]
          : null
        return {
          value: t,
          label: tier?.label ?? t,
          price: tier ? `${formatCents(tier.priceCents)} / mes` : "",
        }
      })
    : []

export function ClientModulesPanel({ client }: ClientModulesPanelProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [maxUsers, setMaxUsers] = useState(client.maxUsers)
  const [maxPosStations, setMaxPosStations] = useState(client.maxPosStations)
  const [extraBranches, setExtraBranches] = useState(client.extraBranches ?? 0)
  const [modules, setModules] = useState({
    facturacionEnabled: client.facturacionEnabled,
    inventoryEnabled: client.inventoryEnabled,
    posEnabled: client.posEnabled,
    paydayEnabled: client.paydayEnabled,
    logisticsEnabled: client.logisticsEnabled,
    apiAccessEnabled: client.apiAccessEnabled,
    whatsappEnabled: client.whatsappEnabled,
    premiumSupportEnabled: client.premiumSupportEnabled,
    biEnabled: client.biEnabled,
    biProEnabled: client.biProEnabled,
  })
  const [creditosEnabled, setCreditosEnabled] = useState(client.creditosEnabled)
  const [motorCreditTier, setMotorCreditTier] = useState<CreditTier | null>(client.motorCreditTier)

  const activeCount =
    Object.values(modules).filter(Boolean).length +
    (creditosEnabled && motorCreditTier ? 1 : 0) +
    (extraBranches > 0 ? 1 : 0)

  const handleSave = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    if (creditosEnabled && !motorCreditTier) {
      setError("Selecciona un tier de Créditos antes de activar el módulo")
      setSaving(false)
      return
    }
    try {
      const res = await fetch(`/api/admin/organizations/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...modules,
          maxUsers,
          maxPosStations,
          extraBranches,
          creditosEnabled,
          // Si el módulo se desactiva, también limpiamos el tier
          motorCreditTier: creditosEnabled ? motorCreditTier : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Error al guardar")
      } else {
        setSuccess("Módulos actualizados correctamente")
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

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          La suscripción es por módulo. Las cuentas pueden tener <strong>0 o más módulos activos</strong> y se agregan/quitan según lo contratado. Los cambios son efectivos inmediatamente.
        </p>
      </div>

      {/* Module toggles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Módulos ({activeCount} activo{activeCount !== 1 ? "s" : ""})
          </h3>
        </div>

        {MODULES.map(({ key, label, description, icon: Icon, color }) => {
          const enabled = modules[key]
          return (
            <div
              key={key}
              onClick={() =>
                setModules((prev) => {
                  const next = { ...prev, [key]: !prev[key] }
                  // Regla: biPro requiere bi.
                  // Si activan biPro, también activamos bi automáticamente.
                  // Si desactivan bi, también desactivamos biPro.
                  if (key === "biProEnabled" && next.biProEnabled) next.biEnabled = true
                  if (key === "biEnabled" && !next.biEnabled) next.biProEnabled = false
                  return next
                })
              }
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
                enabled
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${enabled ? color : "text-gray-400 dark:text-gray-500"}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${enabled ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"}`}>
                  {label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</div>
              </div>
              {/* Toggle */}
              <div className={`w-10 h-6 rounded-full transition-colors shrink-0 relative ${enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
            </div>
          )
        })}

        {/* Módulo de Créditos con tier selector */}
        <div
          className={`rounded-xl border-2 transition-all ${
            creditosEnabled
              ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <div
            onClick={() => setCreditosEnabled((v) => !v)}
            className="flex items-center gap-4 p-4 cursor-pointer select-none"
          >
            <CreditCard
              className={`h-5 w-5 shrink-0 ${
                creditosEnabled ? "text-rose-500" : "text-gray-400 dark:text-gray-500"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-medium ${
                  creditosEnabled
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400"
                }`}
              >
                Créditos
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Gestión de créditos otorgados por el tenant a sus clientes — pricing por escalas
              </div>
            </div>
            <div
              className={`w-10 h-6 rounded-full transition-colors shrink-0 relative ${
                creditosEnabled ? "bg-rose-600" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  creditosEnabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
          </div>
          {creditosEnabled && (
            <div className="border-t border-rose-200 dark:border-rose-800 p-4 pt-3 space-y-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Tier de pricing (límite de clientes con crédito otorgado)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {TIER_OPTIONS.map((opt) => {
                  const selected = motorCreditTier === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMotorCreditTier(opt.value)}
                      className={`text-left rounded-lg border-2 p-3 transition-all ${
                        selected
                          ? "border-rose-500 bg-white dark:bg-gray-800"
                          : "border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <div className="text-xs font-semibold text-gray-900 dark:text-white">
                        {opt.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {opt.price}
                      </div>
                    </button>
                  )
                })}
              </div>
              {!motorCreditTier && (
                <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">
                  Selecciona un tier antes de guardar.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Limits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Máx. usuarios
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMaxUsers((v) => Math.max(1, v - 1))}
              className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >−</button>
            <span className="w-10 text-center text-sm font-semibold text-gray-900 dark:text-white">{maxUsers}</span>
            <button
              onClick={() => setMaxUsers((v) => v + 1)}
              className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >+</button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Máx. cajas POS concurrentes
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMaxPosStations((v) => Math.max(1, v - 1))}
              className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >−</button>
            <span className="w-10 text-center text-sm font-semibold text-gray-900 dark:text-white">{maxPosStations}</span>
            <button
              onClick={() => setMaxPosStations((v) => v + 1)}
              className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >+</button>
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Building2 className="h-4 w-4 text-indigo-500" /> Sucursales extra
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setExtraBranches((v) => Math.max(0, v - 1))}
              className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >−</button>
            <span className="w-10 text-center text-sm font-semibold text-gray-900 dark:text-white">{extraBranches}</span>
            <button
              onClick={() => setExtraBranches((v) => v + 1)}
              className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >+</button>
          </div>
        </div>
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
