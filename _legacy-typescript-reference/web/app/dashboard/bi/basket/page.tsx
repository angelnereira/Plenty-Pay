import { Crown, ShoppingBasket } from "lucide-react"
import Link from "next/link"
import { BasketService, requireBIAccess } from "@/features/bi"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { DataTable } from "@/features/bi/ui/widgets/data-table"

export const dynamic = "force-dynamic"

export default async function BIBasketPage() {
    const access = await requireBIAccess()
    if (!access.pro) {
        return (
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center">
                <Crown className="h-10 w-10 text-violet-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Análisis de canasta</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
                    Descubre qué productos se compran juntos para diseñar bundles y promociones.
                    <strong> BI Pro</strong>.
                </p>
                <Link href="/dashboard/configuracion" className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500">
                    Activar BI Pro
                </Link>
            </div>
        )
    }

    const service = new BasketService()
    const rules = await service.topPairs(access.clientId, { minPairCount: 3, minConfidence: 0.1, limit: 50 })

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Análisis de canasta
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Pares de productos que aparecen juntos. <strong>Lift</strong> &gt; 1 indica afinidad real (no casualidad).
                </p>
            </header>

            <SectionCard
                title="Pares con mayor afinidad"
                subtitle={`${rules.length} reglas · confianza ≥ 10% · lift > 1`}
                action={<ShoppingBasket className="h-5 w-5 text-violet-500" />}
            >
                <DataTable
                    rows={rules}
                    rowKey={(r, i) => `${r.a}-${r.b}-${i}`}
                    emptyLabel="Aún no hay suficientes facturas con múltiples SKUs para detectar patrones."
                    columns={[
                        { header: "#",       accessor: (_, i) => `${i + 1}`, width: "w-10" },
                        { header: "Producto A", accessor: (r) => r.a },
                        { header: "Producto B", accessor: (r) => r.b },
                        { header: "Pares",   accessor: (r) => r.pairCount.toLocaleString("en-US"), align: "right" },
                        { header: "Soporte", accessor: (r) => `${(r.support * 100).toFixed(2)}%`, align: "right" },
                        { header: "Confianza A→B", accessor: (r) => `${(r.confidence * 100).toFixed(1)}%`, align: "right" },
                        { header: "Lift",    accessor: (r) => r.lift.toFixed(2), align: "right" },
                    ]}
                />
            </SectionCard>
        </div>
    )
}
