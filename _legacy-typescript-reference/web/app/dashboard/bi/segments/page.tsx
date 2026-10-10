import { Crown } from "lucide-react"
import Link from "next/link"
import { prisma } from "@core/database"
import { requireBIAccess, SegmentService } from "@/features/bi"
import { SegmentsManager } from "@/features/bi/ui/segments-manager"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"

export const dynamic = "force-dynamic"

export default async function BISegmentsPage() {
    const access = await requireBIAccess()
    if (!access.pro) {
        return (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center">
                <Crown className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Segmentos de clientes</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Define grupos de clientes por reglas (RFM, gasto, frecuencia) y conviértelos
                    en campañas. <strong>BI Pro</strong>.
                </p>
                <Link
                    href="/dashboard/configuracion"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500"
                >
                    Activar BI Pro
                </Link>
            </div>
        )
    }

    const service = new SegmentService()
    // Promise.allSettled: si la vista mv_bi_customer_summary no existe,
    // el RFM preview falla pero los segmentos ya guardados se siguen
    // mostrando. La página renderiza con empty-state en lugar de crashear.
    const settled = await Promise.allSettled([
        prisma.bISavedSegment.findMany({
            where: { clientId: access.clientId },
            orderBy: { createdAt: "desc" },
        }),
        service.previewRFM(access.clientId),
    ])
    const segments = settled[0].status === "fulfilled" ? settled[0].value : []
    const rfmPreview = settled[1].status === "fulfilled" ? settled[1].value : []
    for (const r of settled) {
        if (r.status === "rejected") console.warn("[BI segments] query falló:", r.reason instanceof Error ? r.reason.message : r.reason)
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Segmentos
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Agrupa clientes por reglas para entenderlos mejor o disparar campañas.
                </p>
            </header>

            <SectionCard title="Vista RFM (preview en vivo)" subtitle="Estimación de cuántos clientes caen en cada segmento estándar">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {rfmPreview.map((b) => (
                        <div key={b.key} className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                {b.label}
                            </p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                                {b.count.toLocaleString("en-US")}
                            </p>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <SegmentsManager initialSegments={segments.map((s) => ({
                id: s.id,
                name: s.name,
                rules: s.rules as unknown as { entity: "customer"; rules: Array<{ field: string; op: string; value: number }> },
                cachedCount: s.cachedCount,
                refreshedAt: s.refreshedAt ? s.refreshedAt.toISOString() : null,
            }))} />
        </div>
    )
}
