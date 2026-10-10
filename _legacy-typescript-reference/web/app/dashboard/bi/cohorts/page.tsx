import { Crown } from "lucide-react"
import Link from "next/link"
import { CohortService, requireBIAccess } from "@/features/bi"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { CohortHeatmap } from "@/features/bi/ui/cohort-heatmap"

export const dynamic = "force-dynamic"

export default async function BICohortsPage() {
    const access = await requireBIAccess()
    if (!access.pro) {
        return (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center">
                <Crown className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Cohortes de retención</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Mide cuántos clientes que captaste en un mes siguen comprando en los meses
                    siguientes. <strong>BI Pro</strong>.
                </p>
                <Link href="/dashboard/configuracion" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500">
                    Activar BI Pro
                </Link>
            </div>
        )
    }

    const service = new CohortService()
    const matrix = await service.compute(access.clientId, { months: 12 })

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Cohortes
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Retención de clientes por mes de adquisición. Más oscuro = más clientes que regresaron.
                </p>
            </header>

            <SectionCard title="Retención mensual" subtitle="M+0 = mes de primera compra (100%)">
                <CohortHeatmap cohorts={matrix.cohorts} horizon={matrix.horizon} />
            </SectionCard>
        </div>
    )
}
