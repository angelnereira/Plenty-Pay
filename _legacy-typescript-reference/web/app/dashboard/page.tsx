import { auth } from "@core/auth"
import { redirect } from "next/navigation"

import { RecentInvoices } from "@/components/dashboard/recent-invoices"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { ErrorDisplay } from "@/components/dashboard/error-display"
import Link from "next/link"

export const revalidate = 60; // P2 HAR cache improvement

export default async function DashboardPage() {
  try {
    let session;
    try {
      session = await auth()
    } catch (authError) {
      console.error('[Dashboard] Auth check failed:', authError)
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-800 max-w-md">
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-2">
              Error de Autenticación
            </h2>
            <p className="text-red-600 dark:text-red-300 mb-4">
              No se pudo verificar tu sesión. Esto puede deberse a un problema de conexión.
            </p>
            <Link
              href="/api/auth/signout"
              className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Cerrar Sesión e Intentar de Nuevo
            </Link>
          </div>
        </div>
      )
    }

    if (!session) {
      redirect("/")
    }

    const clientId = session.user.clientId

    if (!clientId) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-800 max-w-md">
            <h2 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-2">
              Sin Organización Asignada
            </h2>
            <p className="text-red-600 dark:text-red-300">
              Tu usuario no tiene una organización configurada. Contacta al administrador del sistema.
            </p>
          </div>
        </div>
      )
    }

    // Obtener datos (ahora vía Server Action para consistencia)
    const { getDashboardData } = await import("@/actions/dashboard-actions")
    const result = await getDashboardData()

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch dashboard data')
    }

    const dashboardData = result.data

    return (
      <DashboardContent
        data={dashboardData}
        userRole={session.user.role}
        inventoryEnabled={session.user.inventoryEnabled}
        posEnabled={session.user.posEnabled}
        paydayEnabled={session.user.paydayEnabled}
        logisticsEnabled={session.user.logisticsEnabled}
      />
    )
  } catch (error) {
    console.error('[Dashboard] Error rendering dashboard:', error)

    return (
      <ErrorDisplay
        title="Error al Cargar Dashboard"
        message="Ocurrió un error al cargar el dashboard. Por favor, intenta recargar la página."
        error={error instanceof Error ? error : { message: 'Fallo al Cargar Dashboard' }}
      />
    )
  }
}
