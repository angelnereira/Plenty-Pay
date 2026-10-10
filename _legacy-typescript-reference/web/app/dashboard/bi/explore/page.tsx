import { Crown } from "lucide-react"
import Link from "next/link"
import { requireBIAccess } from "@/features/bi"
import { ExploreBuilder } from "@/features/bi/ui/explore-builder"

export const dynamic = "force-dynamic"

export default async function ExplorePage({
    searchParams,
}: {
    searchParams: Promise<{ dashboardId?: string }>
}) {
    const access = await requireBIAccess()
    const params = await searchParams

    if (!access.pro) {
        return (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center">
                <Crown className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                    Explorador de datos
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Combina métricas y dimensiones para responder preguntas custom sobre tu negocio.
                    Disponible en <strong>BI Pro</strong>.
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

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Explorador
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Arrastra métricas y dimensiones, previsualiza el resultado y guárdalo como widget.
                </p>
            </header>

            <ExploreBuilder targetDashboardId={params.dashboardId} />
        </div>
    )
}
