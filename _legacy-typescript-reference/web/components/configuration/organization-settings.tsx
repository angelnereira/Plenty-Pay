"use client"

import { useState } from "react"
import { Save, Upload, Building2, Mail, Phone, Globe, MapPin, Info, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"

interface Organization {
  id: string
  name: string
  ruc: string | null
  dv: string | null
  rucType: string
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo: string | null
  isActive: boolean
}

interface OrganizationSettingsProps {
  organization: Organization
}

export function OrganizationSettings({ organization }: OrganizationSettingsProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [formData, setFormData] = useState({
    name: organization.name,
    ruc: organization.ruc || "",
    dv: organization.dv || "",
    rucType: organization.rucType || "2",
    address: organization.address || "",
    phone: organization.phone || "",
    email: organization.email || "",
    website: organization.website || "",
  })
  const [isDgiLoading, setIsDgiLoading] = useState(false)
  const [dgiMsg, setDgiMsg] = useState("")

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    setError("")
    setSuccess("")
  }

  /** Consulta DGI vía HKA para obtener DV y tipoContribuyente oficial */
  const handleConsultarDGI = async () => {
    if (!formData.ruc.trim()) { setDgiMsg("Ingrese el RUC primero"); return }
    setIsDgiLoading(true)
    setDgiMsg("")
    try {
      const res = await fetch("/api/hka/consultar-ruc-dv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruc: formData.ruc.trim(), tipoRuc: formData.rucType }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || "Error al consultar DGI")
      const tipoRucDGI = data.data.tipoRuc as '1' | '2' | undefined
      setFormData(prev => ({
        ...prev,
        dv: data.data.dv || prev.dv,
        ...(tipoRucDGI && { rucType: tipoRucDGI }),
      }))
      const tipoLabel = tipoRucDGI === '1' ? 'Persona Natural' : 'Persona Jurídica'
      setDgiMsg(`✓ DV: ${data.data.dv} · Tipo: ${tipoLabel} · ${data.data.razonSocial}`)
    } catch (err: any) {
      setDgiMsg(`Error: ${err.message}`)
    } finally {
      setIsDgiLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch("/api/configuration/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar organización")
      }

      setSuccess("Organización actualizada correctamente")
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
      <div className="flex items-center space-x-3">
        <Building2 className="h-6 w-6 text-indigo-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Información de la Organización
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Datos fiscales usados para la generación del CUFE y emisión de facturas electrónicas.
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg text-sm">
          ✓ {success}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo Upload */}
        <div className="flex items-center space-x-6">
          <div className="flex-shrink-0">
            {organization.logo ? (
              <img
                src={organization.logo}
                alt="Logo"
                className="h-20 w-20 rounded-xl object-cover border border-gray-200 dark:border-slate-700"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-600">
                <Building2 className="h-10 w-10 text-gray-400" />
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <Upload className="h-4 w-4 mr-2" />
              Subir Logo
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG o SVG (máx. 2MB)</p>
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nombre / Razón Social <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Datos Fiscales — sección informativa */}
        <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/10 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Estos valores se usan para construir el <strong>CUFE</strong>. Deben coincidir
                <strong> exactamente</strong> con los de tu cuenta HKA/DGI. Usa
                "Autocompletar" para obtener los valores oficiales.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConsultarDGI}
              disabled={isDgiLoading || !formData.ruc.trim()}
              title="Consulta DGI para obtener DV y tipoContribuyente oficiales"
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300 bg-white dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-800/40 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${isDgiLoading ? 'animate-spin' : ''}`} />
              {isDgiLoading ? 'Consultando…' : 'Autocompletar desde DGI'}
            </button>
          </div>
          {dgiMsg && (
            <p className={`text-xs mb-3 px-2 py-1.5 rounded-md ${dgiMsg.startsWith('✓') ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
              {dgiMsg}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tipo Contribuyente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo Contribuyente <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.rucType}
                onChange={(e) => handleChange("rucType", e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="2">2 — Persona Jurídica</option>
                <option value="1">1 — Persona Natural</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Usado en posición [2] del CUFE
              </p>
            </div>

            {/* RUC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                RUC <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ruc}
                onChange={(e) => handleChange("ruc", e.target.value.toUpperCase())}
                placeholder={formData.rucType === "1" ? "8-123-45678" : "PE-4-000-000"}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Relleno a 20 chars en CUFE
              </p>
            </div>

            {/* DV */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                DV (Dígito Verificador) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.dv}
                onChange={(e) => handleChange("dv", e.target.value.replace(/\D/g, '').slice(0, 2))}
                maxLength={2}
                placeholder="28"
                className="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                1-2 dígitos, del RUC del emisor
              </p>
            </div>
          </div>
        </div>

        {/* Datos de Contacto */}
        <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
            Datos de Contacto
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Mail className="h-3.5 w-3.5 inline mr-1" />Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Phone className="h-3.5 w-3.5 inline mr-1" />Teléfono
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Globe className="h-3.5 w-3.5 inline mr-1" />Sitio Web
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="https://ejemplo.com"
                className="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <MapPin className="h-3.5 w-3.5 inline mr-1" />Dirección
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex items-center px-5 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
            disabled={isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  )
}
