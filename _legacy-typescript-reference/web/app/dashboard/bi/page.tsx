import { BarChart3, Receipt, ShoppingBag, Users } from "lucide-react"
import { BIQueryService, requireBIAccess } from "@/features/bi"
import { resolvePeriod } from "@/features/bi/lib/period"
import { formatCents } from "@/lib/constants/plans"
import { KpiCard } from "@/features/bi/ui/widgets/kpi-card"
import { BILineChart } from "@/features/bi/ui/widgets/line-chart"
import { TopList } from "@/features/bi/ui/widgets/top-list"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { PeriodFilter } from "@/features/bi/ui/period-filter"

export const dynamic = "force-dynamic"

/**
 * Dashboard "Resumen" — la primera vista que ve el cliente al abrir
 * el módulo BI. Server Component con SSR completo: 6 queries en
 * paralelo al QueryService (sin pasar por el endpoint REST).
 *
 * KPIs:
 *   - Ventas hoy (siempre)
 *   - Ventas período + delta vs período anterior del mismo tamaño
 *   - # facturas período + delta
 *   - Ticket promedio período + delta
 *
 * Visualizaciones:
 *   - Línea de ventas en el período
 *   - Top 5 productos del período
 *   - Top 5 clientes del período
 */
export default async function BIDashboardPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | undefined>>
}) {
    const { clientId } = await requireBIAccess()
    const params = await searchParams
    const period = resolvePeriod(params)
    const today = new Date().toISOString().slice(0, 10)

    const service = new BIQueryService()

    // Promise.allSettled: si alguna query falla (DB caída, vista no
    // creada, timeout) tomamos su default vacío en vez de crashear la
    // página entera y caer al error boundary.
    const settled = await Promise.allSettled([
        service.run(
            { measures: ["sales_total", "invoice_count"], dateRange: { from: today, to: today } },
            { clientId },
        ),
        service.run(
            {
                measures: ["sales_total", "invoice_count", "ticket_avg"],
                dateRange: { from: period.from, to: period.to },
            },
            { clientId },
        ),
        period.previous
            ? service.run(
                  {
                      measures: ["sales_total", "invoice_count", "ticket_avg"],
                      dateRange: period.previous,
                  },
                  { clientId },
              )
            : Promise.resolve({ rows: [] as Array<Record<string, unknown>>, meta: null as never }),
        service.run(
            {
                measures: ["sales_total"],
                dimensions: ["day"],
                dateRange: { from: period.from, to: period.to },
                sortBy: { field: "day", direction: "asc" },
            },
            { clientId },
        ),
        service.run(
            {
                measures: ["gross_sales", "units_sold"],
                dimensions: ["product"],
                sortBy: { field: "gross_sales", direction: "desc" },
                limit: 5,
            },
            { clientId },
        ),
        service.run(
            {
                measures: ["sales_total", "invoice_count"],
                dimensions: ["customer"],
                sortBy: { field: "sales_total", direction: "desc" },
                limit: 5,
            },
            { clientId },
        ),
    ])

    // Extrae las filas de un PromiseSettledResult — empty array si rejected.
    const rowsOf = (r: PromiseSettledResult<{ rows: Array<Record<string, unknown>> }>): Array<Record<string, unknown>> => {
        if (r.status === "fulfilled") return r.value.rows
        console.warn("[BI Resumen] query falló:", r.reason instanceof Error ? r.reason.message : r.reason)
        return []
    }

    const todayRows = rowsOf(settled[0])
    const curRows = rowsOf(settled[1])
    const prevRows = rowsOf(settled[2])
    const seriesRows = rowsOf(settled[3])
    const topProductRows = rowsOf(settled[4])
    const topCustomerRows = rowsOf(settled[5])

    const todaySales = num(todayRows[0]?.sales_total)
    const curSales = num(curRows[0]?.sales_total)
    const curCount = num(curRows[0]?.invoice_count)
    const curTicket = num(curRows[0]?.ticket_avg)
    const prevSales = num(prevRows[0]?.sales_total)
    const prevCount = num(prevRows[0]?.invoice_count)
    const prevTicket = num(prevRows[0]?.ticket_avg)

    const linePoints = seriesRows.map((r) => ({
        label: shortDate(String(r.day)),
        value: num(r.sales_total),
    }))

    const topProductsMax = Math.max(1, ...topProductRows.map((r) => num(r.gross_sales)))
    const topProducts = topProductRows.map((r) => ({
        label: String(r.product ?? "—"),
        sublabel: `${num(r.units_sold).toLocaleString("en-US", { maximumFractionDigits: 0 })} uds`,
        value: formatCents(num(r.gross_sales) * 100),
        weight: num(r.gross_sales) / topProductsMax,
    }))

    const topCustomersMax = Math.max(1, ...topCustomerRows.map((r) => num(r.sales_total)))
    const topCustomers = topCustomerRows.map((r) => ({
        label: String(r.customer ?? "Cliente sin identificar"),
        sublabel: `${num(r.invoice_count).toLocaleString("en-US")} facturas`,
        value: formatCents(num(r.sales_total) * 100),
        weight: num(r.sales_total) / topCustomersMax,
    }))

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        Resumen
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {period.label} — pulso del negocio
                    </p>
                </div>
                <PeriodFilter />
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Ventas hoy"
                    value={formatCents(todaySales * 100)}
                    icon={Receipt}
                />
                <KpiCard
                    label={`Ventas — ${period.label.toLowerCase()}`}
                    value={formatCents(curSales * 100)}
                    delta={delta(curSales, prevSales)}
                    deltaLabel="vs período anterior"
                    icon={BarChart3}
                />
                <KpiCard
                    label={`Facturas — ${period.label.toLowerCase()}`}
                    value={curCount.toLocaleString("en-US")}
                    delta={delta(curCount, prevCount)}
                    deltaLabel="vs período anterior"
                    icon={ShoppingBag}
                />
                <KpiCard
                    label="Ticket promedio"
                    value={formatCents(curTicket * 100)}
                    delta={delta(curTicket, prevTicket)}
                    deltaLabel="vs período anterior"
                    icon={Users}
                />
            </div>

            <SectionCard
                title={`Ventas — ${period.label.toLowerCase()}`}
                subtitle="Total facturado por día"
            >
                {linePoints.length > 0 ? (
                    <BILineChart data={linePoints} valueFormat="currency" />
                ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-12">
                        Aún no hay ventas registradas en el período seleccionado.
                    </div>
                )}
            </SectionCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="Top 5 productos" subtitle="Por ventas brutas (todo el histórico)">
                    <TopList rows={topProducts} accentColor="bg-emerald-500" />
                </SectionCard>
                <SectionCard title="Top 5 clientes" subtitle="Por total facturado (todo el histórico)">
                    <TopList rows={topCustomers} accentColor="bg-violet-500" />
                </SectionCard>
            </div>
        </div>
    )
}

// ---------- helpers ----------

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
