import { redirect } from "next/navigation"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { Bell, Plus } from "lucide-react"
import { CreateNotificationButton } from "@/features/admin/ui/create-notification-button"
import { NotificationsTable } from "@/features/admin/ui/notifications-table"
import { TestPushButton } from "@/features/admin/ui/test-push-button"

export default async function AdminNotificationsPage() {
    const session = await auth()

    // Verificar que el usuario sea Super Admin
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard")
    }

    // Obtener broadcasts
    const broadcasts = await prisma.adminBroadcast.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
    })

    // Estadísticas
    const totalBroadcasts = broadcasts.length
    const activeBroadcasts = broadcasts.filter(b => b.isActive).length
    const scheduledBroadcasts = broadcasts.filter(
        b => b.publishAt > new Date()
    ).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        Notificaciones del Sistema
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Envía notificaciones a todos los usuarios de la plataforma
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <TestPushButton />
                    <CreateNotificationButton />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-lg shadow p-4 border border-gray-200 dark:border-white/[0.1]">
                    <div className="flex items-center space-x-2">
                        <Bell className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Total</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {totalBroadcasts}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-lg shadow p-4 border border-gray-200 dark:border-white/[0.1]">
                    <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Activas</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {activeBroadcasts}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-lg shadow p-4 border border-gray-200 dark:border-white/[0.1]">
                    <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">Programadas</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {scheduledBroadcasts}
                        </p>
                    </div>
                </div>
            </div>

            {/* Notifications Table */}
            <div className="bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-lg shadow border border-gray-200 dark:border-white/[0.1]">
                <div className="p-6 border-b border-gray-200 dark:border-white/[0.1]">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Todas las Notificaciones ({totalBroadcasts})
                    </h2>
                </div>

                <NotificationsTable broadcasts={broadcasts} />
            </div>
        </div>
    )
}
