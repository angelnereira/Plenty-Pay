"use client"

import { useState } from "react"
import { Building2, Users, Plug, UserCircle } from "lucide-react"
import { OrganizationSettings } from "./organization-settings"
import { UsersManagement } from "./users-management"
import { ProfileSettings } from "./profile-settings"
import HKACredentialsForm from "@/components/simple/hka-credentials-form"

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
  metadata: any
  createdAt: Date
  updatedAt: Date
}

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

interface SystemConfig {
  id: string
  key: string
  value: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

interface FolioStats {
  totalAssigned: number
  totalConsumed: number
}

interface ConfigurationTabsProps {
  client: Organization
  users: User[]
  organizations?: { id: string; name: string; ruc: string | null }[]
  systemConfig: SystemConfig | null
  folioStats: FolioStats
  userRole: string
  userId: string
  currentUser: {
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
  isSuperAdmin?: boolean
}

export function ConfigurationTabs({
  client: organization,
  users,
  organizations = [],
  systemConfig,
  folioStats,
  userRole,
  userId,
  currentUser,
  isSuperAdmin = false,
}: ConfigurationTabsProps) {

  // Definir tabs simplificados
  const tabs = [
    {
      id: "profile",
      name: "Mi Perfil",
      icon: UserCircle,
    },
    {
      id: "organization",
      name: "Organización",
      icon: Building2,
      roles: ["SUPER_ADMIN"],
    },
    {
      id: "hka",
      name: "Facturación HKA",
      icon: Plug,
    },
    {
      id: "users",
      name: "Usuarios",
      icon: Users,
      roles: ["SUPER_ADMIN"],
    },
  ];

  const visibleTabs = tabs.filter((tab) => {
    if (!tab.roles) return true
    return tab.roles.includes(userRole)
  });

  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id || "profile");

  return (
    <div className="space-y-6">
      {/* Navegación de Tabs estilo "Pills" */}
      <div className="flex flex-wrap gap-2 p-1 bg-gray-100/50 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive
                  ? "bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200"
                }
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-indigo-500" : "text-gray-500"}`} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Contenido del Tab */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 md:p-8">
          {activeTab === "profile" && (
            <div className="max-w-4xl">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Mi Perfil</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gestiona tu información personal y preferencias.</p>
              </div>
              <ProfileSettings
                user={currentUser}
                organizationName={organization?.name}
              />
            </div>
          )}

          {activeTab === "organization" && (
            <div className="max-w-4xl">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Datos de la Organización</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Información legal y fiscal de tu empresa.</p>
              </div>
              <OrganizationSettings organization={organization} />
            </div>
          )}

          {activeTab === "hka" && (
            <div className="max-w-3xl">
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Plug className="w-5 h-5 text-indigo-500" />
                  Conexión HKA (Facturación Electrónica)
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Configura tus credenciales de The Factory HKA para emitir facturas electrónicas en Panamá.
                </p>
              </div>

              <div className="grid gap-8">
                {/* Credenciales */}
                <section>
                  <HKACredentialsForm />
                </section>

                {/* Información adicional o estado */}
                <section className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Información Importante</h3>
                  <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
                    <li>El ambiente <strong>DEMO</strong> es para pruebas y no tiene validez fiscal.</li>
                    <li>Para emitir facturas reales, cambia al ambiente <strong>PRODUCCIÓN</strong>.</li>
                    <li>Asegúrate de tener folios disponibles en tu cuenta de HKA.</li>
                  </ul>
                </section>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Gestión de Usuarios</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Administra el acceso de tu equipo.</p>
              </div>
              <UsersManagement
                users={users}
                clientId={organization.id}
                organizations={organizations}
                isSuperAdmin={isSuperAdmin}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
