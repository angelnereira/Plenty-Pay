import Link from "next/link"
import { Plus, LayoutDashboard, Crown } from "lucide-react"
import { prisma } from "@core/database"
import { requireBIAccess } from "@/features/bi"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { CreateDashboardButton } from "@/features/bi/ui/create-dashboard-button"

export const dynamic = "force-dynamic"

/**
 * Lista de dashboards custom del cliente. Requiere BI Pro.
 */
export default async function MyDashboardsPage() {
    const access = await requireBIAccess()

    if (!access.pro) {
        return (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center">
                <Crown className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                    Tableros personalizados
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Esta función es parte de <strong>BI Pro</strong>. Construye tus propios
                    dashboards arrastrando métricas y dimensiones — sin código.
                </p>
                <Link
                    href="/dashboard/configuracion"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors"
                >
                    Activar BI Pro
                </Link>
            </div>
        )
    }

    // Promise.allSettled: si la BD/vista falla en una de las dos queries,
    // la otra puede aún renderizar (en lugar de tumbar la página entera
    // al error boundary global).
    const settled = await Promise.allSettled([
        prisma.bIDashboard.findMany({
            where: { clientId: access.clientId },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
            select: { id: true, name: true, isDefault: true, createdAt: true },
        }),
        prisma.bIWidget.groupBy({
            by: ["dashboardId"],
            where: { dashboard: { clientId: access.clientId } },
            _count: { id: true },
        }),
    ])
    const dashboards = settled[0].status === "fulfilled" ? settled[0].value : []
    if (settled[0].status === "rejected") {
        console.warn("[BI dashboards] findMany falló:", settled[0].reason instanceof Error ? settled[0].reason.message : settled[0].reason)
    }
    // Cast pragmático: el tipado del groupBy con _count puede quedar
    // como `{}` si TS aún no refrescó el cliente generado por Prisma.
    // En runtime los campos sí existen.
    const widgetCountsRaw = settled[1].status === "fulfilled" ? settled[1].value : []
    if (settled[1].status === "rejected") {
        console.warn("[BI dashboards] groupBy widgets falló:", settled[1].reason instanceof Error ? settled[1].reason.message : settled[1].reason)
    }
    const widgetCounts = widgetCountsRaw as unknown as Array<{ dashboardId: string; _count: { id: number } }>
    const widgetCountMap = new Map(widgetCounts.map((w) => [w.dashboardId, w._count.id]))

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Mis tableros
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Tus dashboards personalizados. Crea uno nuevo o ábrelo para editar.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/dashboard/bi/explore"
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.06]"
                    >
                        Explorar datos
                    </Link>
                    <CreateDashboardButton />
                </div>
            </header>

            {dashboards.length === 0 ? (
                <SectionCard title="Aún no tienes tableros">
                    <div className="text-center py-8">
                        <LayoutDashboard className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Crea tu primer tablero combinando widgets de ventas, productos y clientes.
                        </p>
                        <CreateDashboardButton variant="primary" />
                    </div>
                </SectionCard>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dashboards.map((d) => (
                        <Link
                            key={d.id}
                            href={`/dashboard/bi/dashboards/${d.id}`}
                            className="group rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 hover:-translate-y-0.5 hover:shadow-md hover:border-violet-500/40 transition-all"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <LayoutDashboard className="h-5 w-5 text-violet-500" />
                                {d.isDefault && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
                                        Por defecto
                                    </span>
                                )}
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                                {d.name}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {(widgetCountMap.get(d.id) ?? 0)} widget{(widgetCountMap.get(d.id) ?? 0) === 1 ? "" : "s"}
                                {" · "}
                                {new Date(d.createdAt).toLocaleDateString("es-PA")}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
