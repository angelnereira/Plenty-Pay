"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ClientInfoPanel }    from "@/features/admin/client/ui/client-info-panel"
import { ClientModulesPanel } from "@/features/admin/client/ui/client-modules-panel"
import { ClientUsersPanel }   from "@/features/admin/client/ui/client-users-panel"
import { ClientAuditPanel }   from "@/features/admin/client/ui/client-audit-panel"

const TABS = [
  { id: "info",    label: "Información" },
  { id: "modules", label: "Módulos & Plan" },
  { id: "users",   label: "Usuarios" },
  { id: "audit",   label: "Historial" },
]

interface ClientDetailTabsProps {
  client: any
  users: any[]
  auditLogs: any[]
  activeTab: string
}

export function ClientDetailTabs({ client, users, auditLogs, activeTab: initialTab }: ClientDetailTabsProps) {
  const [activeTab, setActiveTab] = useState(initialTab || "info")
  const router = useRouter()
  const pathname = usePathname()

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    router.replace(`${pathname}?tab=${tabId}`, { scroll: false })
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Tab nav */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === "info"    && <ClientInfoPanel    client={client} />}
        {activeTab === "modules" && <ClientModulesPanel client={client} />}
        {activeTab === "users"   && <ClientUsersPanel   clientId={client.id} users={users} />}
        {activeTab === "audit"   && <ClientAuditPanel   logs={auditLogs} />}
      </div>
    </div>
  )
}
