import { prisma } from "@core/database"
import { requireBIAccess } from "@/features/bi"
import { AlertsManager } from "@/features/bi/ui/alerts-manager"

export const dynamic = "force-dynamic"

/**
 * /dashboard/bi/alerts — gestión de alertas por umbral.
 * Lista las alertas existentes y permite crear/editar/borrar.
 */
export default async function BIAlertsPage() {
    const { clientId } = await requireBIAccess()

    const rows = await prisma.bIAlert.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
    })

    const initialAlerts = rows.map((a) => ({
        id: a.id,
        name: a.name,
        isActive: a.isActive,
        // El config viene como Json (Prisma) — la UI espera la forma específica
        // de THRESHOLD. Si en el futuro entran ANOMALY (Fase 4), filtramos aquí.
        config: a.config as { metric: string; op: "lt" | "lte" | "gt" | "gte" | "eq"; value: number; period: "today" | "7d" | "30d" },
        lastFiredAt: a.lastFiredAt ? a.lastFiredAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Alertas
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Te avisamos cuando una métrica cruza un umbral. Las notificaciones llegan a tu inbox del dashboard.
                </p>
            </header>

            <AlertsManager initialAlerts={initialAlerts} />
        </div>
    )
}
