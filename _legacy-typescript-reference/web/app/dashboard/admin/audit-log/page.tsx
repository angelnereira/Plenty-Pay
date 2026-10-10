import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { redirect } from "next/navigation"
import { ClipboardList } from "lucide-react"

function getActionBadge(action: string) {
  const upper = action.toUpperCase()

  if (upper.includes("CREATE")) {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  }
  if (upper.includes("UPDATE") || upper.includes("SEND")) {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
  }
  if (upper.includes("DELETE")) {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
}

function formatChanges(changes: string | null): string {
  if (!changes) return "—"

  try {
    const parsed = JSON.parse(changes)
    if (typeof parsed === "object" && parsed !== null) {
      const keys = Object.keys(parsed)
      if (keys.length === 0) return "—"
      if (keys.length <= 3) {
        return keys.join(", ")
      }
      return `${keys.slice(0, 3).join(", ")} (+${keys.length - 3} mas)`
    }
    return String(parsed)
  } catch {
    return changes.length > 60 ? changes.slice(0, 60) + "..." : changes
  }
}

export default async function AuditLogPage() {
  const session = await auth()

  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard")
  }

  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  })

  const totalLogs = logs.length

  const actionCounts = logs.reduce(
    (acc, log) => {
      const upper = log.action.toUpperCase()
      if (upper.includes("CREATE")) acc.creates++
      else if (upper.includes("UPDATE") || upper.includes("SEND")) acc.updates++
      else if (upper.includes("DELETE")) acc.deletes++
      else acc.others++
      return acc
    },
    { creates: 0, updates: 0, deletes: 0, others: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Registro de Auditoría
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Últimas 100 acciones registradas en el sistema
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Total registros</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalLogs}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Creaciones</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{actionCounts.creates}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Actualizaciones</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{actionCounts.updates}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Eliminaciones</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{actionCounts.deletes}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Otras acciones</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{actionCounts.others}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Registros de Actividad ({totalLogs})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Fecha/Hora
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Usuario
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Acción
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Entidad
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  ID Entidad
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Cambios
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No hay registros de auditoría
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      <div className="text-xs">
                        {new Date(log.createdAt).toLocaleDateString("es-PA", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(log.createdAt).toLocaleTimeString("es-PA", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {log.user ? (
                        <div>
                          <div className="font-medium text-xs">{log.user.name ?? "—"}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {log.user.email}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {log.userEmail ?? "Sistema"}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getActionBadge(log.action)}`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300 text-xs font-medium">
                      {log.entity}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {log.entityId.length > 12
                          ? log.entityId.slice(0, 12) + "..."
                          : log.entityId}
                      </code>
                    </td>

                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[200px]">
                      {log.changes ? (
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                            {formatChanges(log.changes)}
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto max-h-40 whitespace-pre-wrap">
                            {(() => {
                              try {
                                return JSON.stringify(JSON.parse(log.changes), null, 2)
                              } catch {
                                return log.changes
                              }
                            })()}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400 text-xs">
                      {log.ip ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
