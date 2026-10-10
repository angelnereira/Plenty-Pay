import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@core/database"
import { requireBIProAccess } from "@/features/bi"
import { CustomDashboardClient } from "@/features/bi/ui/custom-dashboard-client"

export const dynamic = "force-dynamic"

export default async function CustomDashboardPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { clientId } = await requireBIProAccess()
    const { id } = await params

    const dashboard = await prisma.bIDashboard.findFirst({
        where: { id, clientId },
        include: { widgets: { orderBy: { createdAt: "asc" } } },
    })
    if (!dashboard) notFound()

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/bi/dashboards"
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {dashboard.name}
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {dashboard.widgets.length} widget{dashboard.widgets.length === 1 ? "" : "s"}
                        </p>
                    </div>
                </div>
            </header>

            <CustomDashboardClient
                dashboardId={dashboard.id}
                widgets={dashboard.widgets.map((w) => ({
                    id: w.id,
                    type: w.type,
                    title: w.title,
                    query: w.query as Record<string, unknown>,
                }))}
            />
        </div>
    )
}
