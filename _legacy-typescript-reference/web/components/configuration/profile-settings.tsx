"use client"

import { useState } from "react"
import type { ChangeEvent, FormEvent } from "react"

interface ProfileSettingsProps {
  user: {
    id: string
    name: string | null
    email: string
    phone: string | null
    language: string
    timezone: string
    emailNotifications: boolean
    ruc: string | null
    dv: string | null
  }
  organizationName?: string | null
}

const LANGUAGE_OPTIONS = [
  { label: "Español", value: "es" },
  { label: "English", value: "en" },
]

const TIMEZONE_OPTIONS = [
  { label: "America/Panama (UTC-5)", value: "America/Panama" },
  { label: "America/Bogota (UTC-5)", value: "America/Bogota" },
  { label: "America/Mexico_City (UTC-6)", value: "America/Mexico_City" },
  { label: "America/New_York (UTC-5/-4)", value: "America/New_York" },
]

export function ProfileSettings({ user, organizationName }: ProfileSettingsProps) {
  const [formState, setFormState] = useState({
    name: user.name ?? "",
    phone: user.phone ?? "",
    language: user.language ?? "es",
    timezone: user.timezone ?? "America/Panama",
    emailNotifications: user.emailNotifications,
    ruc: user.ruc ?? "",
    dv: user.dv ?? "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = event.target as HTMLInputElement
    setFormState((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleRucChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase()
    setFormState((prev) => ({
      ...prev,
      ruc: value,
    }))
  }

  const handleDvChange = (event: ChangeEvent<HTMLInputElement>) => {
    const numeric = event.target.value.replace(/[^0-9]/g, "")
    setFormState((prev) => ({
      ...prev,
      dv: numeric,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    setIsSaving(true)

    try {
      const response = await fetch("/api/settings/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formState,
          phone: formState.phone?.trim() || null,
          ruc: formState.ruc.trim(),
          dv: formState.dv.trim(),
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload?.success) {
        const message =
          payload?.error || "No se pudo actualizar el perfil. Intenta nuevamente."
        throw new Error(message)
      }

      setStatus({
        type: "success",
        message: "Perfil actualizado correctamente.",
      })
    } catch (error) {
      console.error("[ProfileSettings] Error updating profile", error)
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Error desconocido al actualizar el perfil.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Perfil del usuario
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Administra tu información personal y preferencias de notificación.
          </p>
        </div>

        {status && (
          <div
            className={`mb-4 rounded-md border px-4 py-3 text-sm ${status.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
              }`}
          >
            {status.message}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Nombre completo
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formState.name}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="mt-1 w-full rounded-md border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Teléfono
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formState.phone}
                onChange={handleChange}
                placeholder="+507 0000-0000"
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="ruc"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                RUC personal (obligatorio para firma)
              </label>
              <input
                id="ruc"
                name="ruc"
                type="text"
                required
                value={formState.ruc}
                onChange={handleRucChange}
                placeholder="Ej: 8-488-194 o E-8-123-456"
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Debe coincidir con el RUC registrado en tus certificados P12/PFX personales.
              </p>
            </div>

            <div>
              <label
                htmlFor="dv"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Dígito verificador (DV)
              </label>
              <input
                id="dv"
                name="dv"
                type="text"
                required
                maxLength={2}
                value={formState.dv}
                onChange={handleDvChange}
                placeholder="Ej: 41"
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Idioma
              </label>
              <select
                id="language"
                name="language"
                value={formState.language}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="timezone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Zona horaria
              </label>
              <select
                id="timezone"
                name="timezone"
                value={formState.timezone}
                onChange={handleChange}
                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-3">
              <input
                id="emailNotifications"
                name="emailNotifications"
                type="checkbox"
                checked={formState.emailNotifications}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label
                htmlFor="emailNotifications"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Recibir notificaciones por correo electrónico
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {organizationName ? (
                <span className="block">
                  Organización actual: <strong>{organizationName}</strong>
                </span>
              ) : (
                <span className="block">
                  No hay organización asociada. Contacta soporte si necesitas configurar una.
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
      <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
        <p className="font-semibold uppercase tracking-wide">Importante para firmas digitales</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            El <strong>RUC personal</strong> y el <strong>DV</strong> se utilizan cuando seleccionas el modo de firma
            personal. Deben coincidir con los datos del certificado <code>.p12/.pfx</code> que subas.
          </li>
          <li>
            Si firmas con certificados de la organización, se usará el RUC de la empresa configurado por el
            administrador.
          </li>
          <li>
            Cada usuario mantiene sus credenciales y certificados aislados; ninguna otra cuenta puede reutilizarlos.
          </li>
        </ul>
      </div>
    </div>
  )
}

