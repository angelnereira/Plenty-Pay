import { Crown, Sparkles, RefreshCw } from "lucide-react"
import Link from "next/link"
import { requireBIAccess, ForecastService } from "@/features/bi"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { ForecastChart } from "@/features/bi/ui/forecast-chart"
import { ForecastRunButton } from "@/features/bi/ui/forecast-run-button"

export const dynamic = "force-dynamic"

export default async function BIForecastPage() {
    const access = await requireBIAccess()
    if (!access.pro) {
        return (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center">
                <Crown className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                    Predicción de ventas
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Anticipa los próximos 30/60/90 días con un modelo de estacionalidad
                    semanal entrenado sobre tu propio histórico. Disponible en <strong>BI Pro</strong>.
                </p>
                <Link
                    href="/dashboard/configuracion"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rameres-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors"
                >
                    Activar BI Pro
                </Link>
            </div>
        )
    }

    const service = new ForecastService()
    let fc = await service.latest(access.clientId, "sales_total")
    if (!fc) {
        fc = await service.computeAndSave(access.clientId, "sales_total", { horizonDays: 30 })
    }
    const data = (fc.data as unknown as Array<{ date: string; predicted: number; lower: number; upper: number; historical?: boolean; actual?: number }>) ?? []
    const horizonDays = data.filter((d) => !d.historical).length

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Predicción de ventas
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Heurística: media móvil 7d + estacionalidad semanal · banda ±1σ · horizonte {horizonDays} días.
                    </p>
                </div>
                <ForecastRunButton metric="sales_total" />
            </header>

            <SectionCard
                title="Ventas — predicción próximos días"
                subtitle={`Última corrida: ${new Date(fc.computedAt).toLocaleString("es-PA")}`}
            >
                <ForecastChart data={data} valueFormat="currency" />
                <div className="mt-4 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <span>Azul = histórico real · Violeta = predicción · Banda morada = rango de confianza</span>
                </div>
            </SectionCard>
        </div>
    )
}
