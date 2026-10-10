import { Users, BarChart3, Receipt, TrendingUp } from "lucide-react"
import { BIQueryService, requireBIAccess } from "@/features/bi"
import { formatCents } from "@/lib/constants/plans"
import { KpiCard } from "@/features/bi/ui/widgets/kpi-card"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { DataTable } from "@/features/bi/ui/widgets/data-table"
import { ExportButton } from "@/features/bi/ui/export-button"

export const dynamic = "force-dynamic"

interface CustomerRow {
    customer: string
    sales_total: number
    invoice_count: number
    ticket_avg: number
}

/**
 * Dashboard "Clientes" — Top compradores con ticket y frecuencia.
 *
 * Como `mv_bi_customer_summary` agrupa por (clientId, customerId), una
 * fila por comprador. Quienes vinieron sin RUC (consumidor final) caen
 * en "Cliente sin identificar" — futuro: separarlos en su propia card.
 */
export default async function BIClientesPage() {
    const { clientId } = await requireBIAccess()
    const service = new BIQueryService()

    const rowsRes = await service.run(
        {
            measures: ["sales_total", "invoice_count", "ticket_avg"],
            dimensions: ["customer"],
            sortBy: { field: "sales_total", direction: "desc" },
            limit: 100,
        },
        { clientId },
    )

    const rows = rowsRes.rows as unknown as CustomerRow[]
    const totalCustomers = rows.length
    const totalSales = rows.reduce((s, r) => s + num(r.sales_total), 0)
    const totalInvoices = rows.reduce((s, r) => s + num(r.invoice_count), 0)
    const overallTicket = totalInvoices > 0 ? totalSales / totalInvoices : 0

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Clientes
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Top compradores por total facturado — histórico completo
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Clientes únicos"
                    value={totalCustomers.toLocaleString("en-US")}
                    icon={Users}
                />
                <KpiCard
                    label="Ventas totales"
                    value={formatCents(totalSales * 100)}
                    icon={BarChart3}
                />
                <KpiCard
                    label="Facturas totales"
                    value={totalInvoices.toLocaleString("en-US")}
                    icon={Receipt}
                />
                <KpiCard
                    label="Ticket promedio global"
                    value={formatCents(overallTicket * 100)}
                    icon={TrendingUp}
                />
            </div>

            <SectionCard
                title="Top clientes"
                subtitle={`${rows.length} compradores`}
                action={
                    <ExportButton
                        title="Top clientes"
                        subtitle={`Histórico completo · ${rows.length} compradores`}
                        filename="bi-clientes"
                        query={{
                            measures: ["sales_total", "invoice_count", "ticket_avg"],
                            dimensions: ["customer"],
                            sortBy: { field: "sales_total", direction: "desc" },
                            limit: 1000,
                        }}
                    />
                }
            >
                <DataTable
                    rows={rows}
                    rowKey={(r, i) => `${r.customer}-${i}`}
                    emptyLabel="Aún no hay clientes con compras registradas."
                    columns={[
                        { header: "#",            accessor: (_, i) => `${i + 1}`, width: "w-10" },
                        { header: "Cliente",      accessor: (r) => r.customer ?? "Cliente sin identificar" },
                        { header: "Facturas",     accessor: (r) => num(r.invoice_count).toLocaleString("en-US"), align: "right" },
                        { header: "Ticket prom.", accessor: (r) => formatCents(num(r.ticket_avg) * 100), align: "right" },
                        { header: "Total facturado", accessor: (r) => formatCents(num(r.sales_total) * 100), align: "right" },
                        { header: "% del total",  accessor: (r) => `${(totalSales > 0 ? (num(r.sales_total) / totalSales) * 100 : 0).toFixed(1)}%`, align: "right" },
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
