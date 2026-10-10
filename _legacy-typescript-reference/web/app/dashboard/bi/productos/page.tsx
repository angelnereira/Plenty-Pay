import { Boxes, ShoppingBag, BarChart3 } from "lucide-react"
import { BIQueryService, requireBIAccess } from "@/features/bi"
import { formatCents } from "@/lib/constants/plans"
import { KpiCard } from "@/features/bi/ui/widgets/kpi-card"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { DataTable } from "@/features/bi/ui/widgets/data-table"
import { ExportButton } from "@/features/bi/ui/export-button"

export const dynamic = "force-dynamic"

interface ProductRow {
    product: string
    gross_sales: number
    units_sold: number
}

/**
 * Dashboard "Productos" — desempeño por SKU desde mv_bi_product_performance.
 *
 * NOTA: la vista materializada agrega histórico completo por SKU (no por
 * período) — refleja vida útil del producto. Filtros por período llegan
 * en Fase 1.5 cuando dividamos la vista por mes.
 */
export default async function BIProductosPage() {
    const { clientId } = await requireBIAccess()
    const service = new BIQueryService()

    const rowsRes = await service.run(
        {
            measures: ["gross_sales", "units_sold"],
            dimensions: ["product"],
            sortBy: { field: "gross_sales", direction: "desc" },
            limit: 100,
        },
        { clientId },
    )

    const rows = rowsRes.rows as unknown as ProductRow[]
    const totalProducts = rows.length
    const totalUnits = rows.reduce((s, r) => s + num(r.units_sold), 0)
    const totalSales = rows.reduce((s, r) => s + num(r.gross_sales), 0)

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Productos
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Top SKUs por ventas brutas — histórico completo
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard
                    label="SKUs vendidos"
                    value={totalProducts.toLocaleString("en-US")}
                    icon={Boxes}
                />
                <KpiCard
                    label="Unidades totales"
                    value={totalUnits.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    icon={ShoppingBag}
                />
                <KpiCard
                    label="Ventas brutas"
                    value={formatCents(totalSales * 100)}
                    icon={BarChart3}
                />
            </div>

            <SectionCard
                title="Top productos"
                subtitle={`${rows.length} SKUs`}
                action={
                    <ExportButton
                        title="Top productos"
                        subtitle={`Histórico completo · ${rows.length} SKUs`}
                        filename="bi-productos"
                        query={{
                            measures: ["gross_sales", "units_sold"],
                            dimensions: ["product"],
                            sortBy: { field: "gross_sales", direction: "desc" },
                            limit: 1000,
                        }}
                    />
                }
            >
                <DataTable
                    rows={rows}
                    rowKey={(r, i) => `${r.product}-${i}`}
                    emptyLabel="Aún no hay productos vendidos."
                    columns={[
                        { header: "#",          accessor: (_, i) => `${i + 1}`, width: "w-10" },
                        { header: "Producto",   accessor: (r) => r.product ?? "—" },
                        { header: "Unidades",   accessor: (r) => num(r.units_sold).toLocaleString("en-US", { maximumFractionDigits: 0 }), align: "right" },
                        { header: "Ventas brutas", accessor: (r) => formatCents(num(r.gross_sales) * 100), align: "right" },
                        { header: "% del total", accessor: (r) => `${(totalSales > 0 ? (num(r.gross_sales) / totalSales) * 100 : 0).toFixed(1)}%`, align: "right" },
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
