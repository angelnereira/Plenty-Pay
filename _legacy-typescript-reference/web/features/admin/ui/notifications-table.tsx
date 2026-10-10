"use client"

import { AdminBroadcast } from "@prisma/client"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CheckCircle, XCircle, AlertTriangle, Info, Sparkles } from "lucide-react"

interface NotificationsTableProps {
    broadcasts: AdminBroadcast[]
}

export function NotificationsTable({ broadcasts }: NotificationsTableProps) {
    const getTypeIcon = (type: string) => {
        switch (type) {
            case "WARNING":
                return <AlertTriangle className="h-4 w-4 text-yellow-500" />
            case "MAINTENANCE":
                return <AlertTriangle className="h-4 w-4 text-orange-500" />
            case "FEATURE":
                return <Sparkles className="h-4 w-4 text-purple-500" />
            default:
                return <Info className="h-4 w-4 text-blue-500" />
        }
    }

    const getTypeBadgeColor = (type: string) => {
        switch (type) {
            case "WARNING":
                return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
            case "MAINTENANCE":
                return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400"
            case "FEATURE":
                return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400"
            default:
                return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
        }
    }

    return (
        <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Título
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Tipo
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Publicado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Expira
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {broadcasts.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                No hay notificaciones creadas
                            </td>
                        </tr>
                    ) : (
                        broadcasts.map((broadcast) => (
                            <tr key={broadcast.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {broadcast.title}
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                                            {broadcast.message}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center space-x-2">
                                        {getTypeIcon(broadcast.type)}
                                        <span
                                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(
                                                broadcast.type
                                            )}`}
                                        >
                                            {broadcast.type}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {broadcast.isActive ? (
                                        <span className="inline-flex items-center text-sm text-green-600 dark:text-green-400">
                                            <CheckCircle className="h-4 w-4 mr-1" />
                                            Activa
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400">
                                            <XCircle className="h-4 w-4 mr-1" />
                                            Inactiva
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {format(new Date(broadcast.publishAt), "dd MMM yyyy, HH:mm", { locale: es })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {broadcast.expiresAt
                                        ? format(new Date(broadcast.expiresAt), "dd MMM yyyy", { locale: es })
                                        : "Nunca"}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
