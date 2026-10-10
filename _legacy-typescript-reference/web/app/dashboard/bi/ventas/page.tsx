import { BarChart3, Receipt, TrendingUp, ShoppingBag } from "lucide-react"
import { BIQueryService, requireBIAccess } from "@/features/bi"
import { resolvePeriod } from "@/features/bi/lib/period"
import { formatCents } from "@/lib/constants/plans"
import { KpiCard } from "@/features/bi/ui/widgets/kpi-card"
import { BILineChart } from "@/features/bi/ui/widgets/line-chart"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { DataTable } from "@/features/bi/ui/widgets/data-table"
import { PeriodFilter } from "@/features/bi/ui/period-filter"
import { ExportButton } from "@/features/bi/ui/export-button"

export const dynamic = "force-dynamic"

interface DayRow {
    day: string
    sales_total: number
    invoice_count: number
    ticket_avg: number
    discounts: number
}

/**
 * Dashboard "Ventas" — desempeño en el tiempo + tabla detallada por día.
 */
export default async function BIVentasPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | undefined>>
}) {
    const { clientId } = await requireBIAccess()
    const params = await searchParams
    const period = resolvePeriod(params)

    const service = new BIQueryService()

    const settled = await Promise.allSettled([
        service.run(
            {
                measures: ["sales_total", "invoice_count", "ticket_avg", "discounts"],
                dateRange: { from: period.from, to: period.to },
            },
            { clientId },
        ),
        period.previous
            ? service.run(
                  {
                      measures: ["sales_total", "invoice_count", "ticket_avg", "discounts"],
                      dateRange: period.previous,
                  },
                  { clientId },
              )
            : Promise.resolve({ rows: [] as Array<Record<string, unknown>>, meta: null as never }),
        service.run(
            {
                measures: ["sales_total", "invoice_count", "ticket_avg", "discounts"],
                dimensions: ["day"],
                dateRange: { from: period.from, to: period.to },
                sortBy: { field: "day", direction: "desc" },
            },
            { clientId },
        ),
    ])

    const rowsOf = (r: PromiseSettledResult<{ rows: Array<Record<string, unknown>> }>): Array<Record<string, unknown>> => {
        if (r.status === "fulfilled") return r.value.rows
        console.warn("[BI Ventas] query falló:", r.reason instanceof Error ? r.reason.message : r.reason)
        return []
    }
    const totals = rowsOf(settled[0])[0] ?? {}
    const prev = rowsOf(settled[1])[0] ?? {}
    const days = rowsOf(settled[2]) as unknown as DayRow[]

    const linePoints = [...days]
        .reverse()
        .map((r) => ({ label: shortDate(String(r.day)), value: num(r.sales_total) }))

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Ventas
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {period.label}
                    </p>
                </div>
                <PeriodFilter />
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Ventas"
                    value={formatCents(num(totals.sales_total) * 100)}
                    delta={delta(num(totals.sales_total), num(prev.sales_total))}
                    deltaLabel="vs período anterior"
                    icon={BarChart3}
                />
                <KpiCard
                    label="Facturas"
                    value={num(totals.invoice_count).toLocaleString("en-US")}
                    delta={delta(num(totals.invoice_count), num(prev.invoice_count))}
                    deltaLabel="vs período anterior"
                    icon={Receipt}
                />
                <KpiCard
                    label="Ticket promedio"
                    value={formatCents(num(totals.ticket_avg) * 100)}
                    delta={delta(num(totals.ticket_avg), num(prev.ticket_avg))}
                    deltaLabel="vs período anterior"
                    icon={TrendingUp}
                />
                <KpiCard
                    label="Descuentos otorgados"
                    value={formatCents(num(totals.discounts) * 100)}
                    icon={ShoppingBag}
                />
            </div>

            <SectionCard title="Evolución diaria" subtitle="Total facturado por día en el período">
                {linePoints.length > 0 ? (
                    <BILineChart data={linePoints} valueFormat="currency" />
                ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-12">
                        Aún no hay ventas registradas en el período.
                    </div>
                )}
            </SectionCard>

            <SectionCard
                title="Detalle por día"
                subtitle="Más reciente primero"
                action={
                    <ExportButton
                        title="Ventas por día"
                        subtitle={`${period.from} → ${period.to}`}
                        filename={`bi-ventas-${period.from}-${period.to}`}
                        query={{
                            measures: ["sales_total", "invoice_count", "ticket_avg", "discounts"],
                            dimensions: ["day"],
                            dateRange: { from: period.from, to: period.to },
                            sortBy: { field: "day", direction: "desc" },
                        }}
                    />
                }
            >
                <DataTable
                    rows={days}
                    rowKey={(r) => r.day}
                    emptyLabel="Sin ventas en el período."
                    columns={[
                        { header: "Fecha",       accessor: (r) => fullDate(String(r.day)) },
                        { header: "Facturas",    accessor: (r) => num(r.invoice_count).toLocaleString("en-US"), align: "right" },
                        { header: "Ventas",      accessor: (r) => formatCents(num(r.sales_total) * 100), align: "right" },
                        { header: "Ticket prom.",accessor: (r) => formatCents(num(r.ticket_avg) * 100), align: "right" },
                        { header: "Descuentos", accessor: (r) => formatCents(num(r.discounts) * 100), align: "right" },
                    ]}
                />
            </SectionCard>
        </div>
    )
}

function num(value: unknown): number {
    if (value === null || value === undefined) return 0
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

function delta(current: number, previous: number): number | undefined {
    if (previous === 0) return current === 0 ? 0 : undefined
    return (current - previous) / previous
}

function shortDate(iso: string): string {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString("es-PA", { day: "2-digit", month: "short" })
}

function fullDate(iso: string): string {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" })
}
