import { Users, AlertCircle, CheckCircle2, Clock, DollarSign, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { requireBIAccess } from "@/features/bi"
import { getCreditAging, getCreditKpis, type CreditStatus } from "@/features/bi/model/repositories/bi-phase15.repository"
import { formatCents } from "@/lib/constants/plans"
import { KpiCard } from "@/features/bi/ui/widgets/kpi-card"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { DataTable } from "@/features/bi/ui/widgets/data-table"

export const dynamic = "force-dynamic"

const STATUS_BADGE: Record<CreditStatus, { label: string; cls: string }> = {
    HEALTHY:    { label: "Sano",       cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
    WARNING:    { label: "Atención",   cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20" },
    OVER_LIMIT: { label: "Sobre el límite", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20" },
    OVERDUE:    { label: "Vencido",    cls: "bg-rose-600/20 text-rose-800 dark:text-rose-200 border-rose-600/30" },
}

/**
 * Dashboard "Créditos" — utilización del crédito otorgado por entidad
 * y aging. Lee mv_bi_credit_aging (refrescada cada 30 min).
 *
 * Solo aparece si el cliente tiene `creditosEnabled` — pero el dashboard
 * funciona aunque no — simplemente mostrará 0 entidades.
 */
export default async function BICreditosPage() {
    const { clientId } = await requireBIAccess()
    // Promise.allSettled: si la vista mv_bi_credit_aging no existe aún o
    // el motor de créditos está vacío, una query fallida no tumba la página.
    const settled = await Promise.allSettled([
        getCreditKpis(clientId),
        getCreditAging(clientId, { limit: 200 }),
    ])
    const kpis = settled[0].status === "fulfilled"
        ? settled[0].value
        : { entities_total: 0, healthy: 0, warning: 0, over_limit: 0, overdue: 0, total_outstanding_cents: 0, total_limit_cents: 0 }
    const allRows = settled[1].status === "fulfilled" ? settled[1].value : []
    for (const r of settled) {
        if (r.status === "rejected") console.warn("[BI creditos] query falló:", r.reason instanceof Error ? r.reason.message : r.reason)
    }

    const utilizationGlobal = kpis.total_limit_cents > 0
        ? (Number(kpis.total_outstanding_cents) / Number(kpis.total_limit_cents))
        : 0

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Créditos
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Utilización por cliente, sobreexpuestos y cuentas vencidas.
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Clientes con crédito" value={kpis.entities_total.toLocaleString("en-US")} icon={Users} />
                <KpiCard
                    label="Saldo otorgado"
                    value={formatCents(Number(kpis.total_outstanding_cents))}
                    icon={DollarSign}
                />
                <KpiCard
                    label="Utilización global"
                    value={`${(utilizationGlobal * 100).toFixed(1)}%`}
                    icon={TrendingUp}
                    accentColor={utilizationGlobal >= 0.8 ? "text-rose-600 dark:text-rose-400" : "text-violet-600 dark:text-violet-400"}
                />
                <KpiCard
                    label="Cuentas vencidas"
                    value={kpis.overdue.toLocaleString("en-US")}
                    icon={Clock}
                    accentColor="text-rose-600 dark:text-rose-400"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard label="Sanos" value={kpis.healthy.toLocaleString("en-US")} icon={CheckCircle2} accentColor="text-emerald-600 dark:text-emerald-400" />
                <KpiCard label="En atención" value={kpis.warning.toLocaleString("en-US")} icon={AlertCircle} accentColor="text-amber-600 dark:text-amber-400" />
                <KpiCard label="Sobre el límite" value={kpis.over_limit.toLocaleString("en-US")} icon={AlertCircle} accentColor="text-rose-600 dark:text-rose-400" />
            </div>

            <SectionCard title="Aging por entidad" subtitle={`${allRows.length} clientes con crédito otorgado`}>
                <DataTable
                    rows={allRows}
                    rowKey={(r) => r.entity_id}
                    emptyLabel="Aún no hay clientes con crédito otorgado."
                    columns={[
                        { header: "Cliente",   accessor: (r) => r.name },
                        { header: "Documento", accessor: (r) => r.document ?? "—" },
                        { header: "Límite",    accessor: (r) => formatCents(Number(r.credit_limit_cents)), align: "right" },
                        { header: "Saldo",     accessor: (r) => formatCents(Number(r.current_balance_cents)), align: "right" },
                        { header: "Util.",     accessor: (r) => `${Number(r.utilization_pct).toFixed(1)}%`, align: "right" },
                        {
                            header: "Estado",
                            accessor: (r) => {
                                const badge = STATUS_BADGE[r.status]
                                return (
                                    <span className={cn("inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border", badge.cls)}>
                                        {badge.label}
                                    </span>
                                )
                            },
                            align: "center",
                        },
                        {
                            header: "Vence",
                            accessor: (r) => r.payment_due_at
                                ? new Date(r.payment_due_at).toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" })
                                : "—",
                            align: "right",
                        },
                    ]}
                />
            </SectionCard>
        </div>
    )
}
