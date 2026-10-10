import { Crown, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { AnomalyService, requireBIAccess } from "@/features/bi"
import { formatCents } from "@/lib/constants/plans"
import { KpiCard } from "@/features/bi/ui/widgets/kpi-card"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { DataTable } from "@/features/bi/ui/widgets/data-table"

export const dynamic = "force-dynamic"

const SEVERITY_BADGE: Record<string, string> = {
    low:    "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    medium: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    high:   "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
}

export default async function BIAnomaliesPage() {
    const access = await requireBIAccess()
    if (!access.pro) {
        return (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center">
                <Crown className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Detección de anomalías</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Te avisamos automáticamente cuando tus ventas tienen un pico o caída fuera
                    de lo normal (3σ). Disponible en <strong>BI Pro</strong>.
                </p>
                <Link href="/dashboard/configuracion" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500">
                    Activar BI Pro
                </Link>
            </div>
        )
    }

    const service = new AnomalyService()
    const result = await service.detect(access.clientId, { metric: "sales_total", days: 60 })
    const drops = result.points.filter((p) => p.direction === "drop").length
    const spikes = result.points.filter((p) => p.direction === "spike").length

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Anomalías
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Días en los últimos 60 con desviación ≥ 3σ vs la media móvil. Más recientes primero.
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard label="Anomalías detectadas" value={result.points.length.toString()} icon={AlertTriangle} accentColor="text-orange-600 dark:text-orange-400" />
                <KpiCard label="Caídas atípicas" value={drops.toString()} icon={TrendingDown} accentColor="text-rose-600 dark:text-rose-400" />
                <KpiCard label="Picos atípicos" value={spikes.toString()} icon={TrendingUp} accentColor="text-emerald-600 dark:text-emerald-400" />
            </div>

            <SectionCard title="Días anómalos" subtitle={`Sensibilidad 3σ · σ = ${result.sigma.toFixed(2)}`}>
                <DataTable
                    rows={result.points}
                    rowKey={(p) => p.date}
                    emptyLabel="Sin anomalías detectadas en el período. Tu negocio se comporta dentro de lo esperado."
                    columns={[
                        { header: "Fecha", accessor: (p) => new Date(p.date).toLocaleDateString("es-PA", { day: "2-digit", month: "short" }) },
                        { header: "Tipo", accessor: (p) => (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold">
                                {p.direction === "drop"
                                    ? <><TrendingDown className="h-3.5 w-3.5 text-rose-500" />Caída</>
                                    : <><TrendingUp className="h-3.5 w-3.5 text-emerald-500" />Pico</>}
                            </span>
                        )},
                        { header: "Real", accessor: (p) => formatCents(p.value * 100), align: "right" },
                        { header: "Esperado", accessor: (p) => formatCents(p.expected * 100), align: "right" },
                        { header: "σ", accessor: (p) => p.sigmas.toFixed(2), align: "right" },
                        {
                            header: "Severidad",
                            accessor: (p) => (
                                <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border", SEVERITY_BADGE[p.severity])}>
                                    {p.severity.toUpperCase()}
                                </span>
                            ),
                            align: "center",
                        },
                    ]}
                />
            </SectionCard>
        </div>
    )
}
