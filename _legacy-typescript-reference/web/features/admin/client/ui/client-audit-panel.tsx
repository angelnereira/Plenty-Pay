"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

interface AuditEntry {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  entity: string
  entityId: string
  changes: string | null
  ip: string | null
  createdAt: Date
}

interface ClientAuditPanelProps {
  logs: AuditEntry[]
}

export function ClientAuditPanel({ logs }: ClientAuditPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const ACTION_LABELS: Record<string, string> = {
    CLIENT_CREATE:              "Cliente creado",
    CLIENT_UPDATE:              "Cliente actualizado",
    USER_CREATE:                "Usuario creado",
    USER_UPDATE:                "Usuario actualizado",
    USER_DEACTIVATE:            "Usuario desactivado",
    USER_IMPERSONATE:           "Impersonación iniciada",
    ADMIN_GENERATE_RESET_LINK:  "Reset link generado",
    APPROVAL_APPROVED:          "Aprobación aprobada",
    APPROVAL_REJECTED:          "Aprobación rechazada",
    UPGRADE_APPROVED:           "Upgrade aprobado",
  }

  const formatChanges = (changes: string | null): string => {
    if (!changes) return ""
    try {
      return JSON.stringify(JSON.parse(changes), null, 2)
    } catch {
      return changes
    }
  }

  return (
    <div className="space-y-2">
      {logs.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
          No hay entradas de auditoría
        </p>
      )}
      {logs.map((log) => (
        <div
          key={log.id}
          className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
        >
          <button
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
          >
            {expandedId === log.id
              ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                  {log.entity}
                </span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {log.userEmail ?? "Sistema"} ·{" "}
                {new Date(log.createdAt).toLocaleString("es-PA", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {log.ip && ` · IP: ${log.ip}`}
              </div>
            </div>
          </button>
          {expandedId === log.id && log.changes && (
            <div className="px-4 pb-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
              <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all mt-2 font-mono">
                {formatChanges(log.changes)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
