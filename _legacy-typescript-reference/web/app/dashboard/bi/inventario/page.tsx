import { Boxes, AlertTriangle, ArchiveX, DollarSign } from "lucide-react"
import { requireBIAccess } from "@/features/bi"
import { getInventoryKpis, getInventorySnapshot } from "@/features/bi/model/repositories/bi-phase15.repository"
import { formatCents } from "@/lib/constants/plans"
import { KpiCard } from "@/features/bi/ui/widgets/kpi-card"
import { SectionCard } from "@/features/bi/ui/widgets/section-card"
import { DataTable } from "@/features/bi/ui/widgets/data-table"

export const dynamic = "force-dynamic"

/**
 * Dashboard "Inventario" — fotografía del stock y rotación reciente.
 * Lee mv_bi_inventory_snapshot (refrescada cada 30 min).
 */
export default async function BIInventarioPage() {
    const { clientId } = await requireBIAccess()
    // Promise.allSettled: si la vista materializada mv_bi_inventory_snapshot
    // no existe aún o la BD tirembla, una query fallida no tumba la página.
    const settled = await Promise.allSettled([
        getInventoryKpis(clientId),
        getInventorySnapshot(clientId, { limit: 50, orderBy: "low" }),
        getInventorySnapshot(clientId, { limit: 50, orderBy: "dead" }),
        getInventorySnapshot(clientId, { limit: 50, orderBy: "value" }),
    ])
    const kpis = settled[0].status === "fulfilled"
        ? settled[0].value
        : { skus_total: 0, skus_low: 0, skus_dead: 0, inventory_value: 0 }
    const lowStockRows = settled[1].status === "fulfilled" ? settled[1].value : []
    const deadStockRows = settled[2].status === "fulfilled" ? settled[2].value : []
    const valueRows = settled[3].status === "fulfilled" ? settled[3].value : []
    for (const r of settled) {
        if (r.status === "rejected") console.warn("[BI inventario] query falló:", r.reason instanceof Error ? r.reason.message : r.reason)
    }

    const lowStock = lowStockRows.filter((r) => r.is_low_stock)
    const deadStock = deadStockRows.filter((r) => r.is_dead_stock)

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    Inventario
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Stock actual, rotación de los últimos 30 días y SKUs en riesgo.
                </p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="SKUs activos" value={kpis.skus_total.toLocaleString("en-US")} icon={Boxes} />
                <KpiCard
                    label="SKUs en stock bajo"
                    value={kpis.skus_low.toLocaleString("en-US")}
                    icon={AlertTriangle}
                    accentColor="text-amber-600 dark:text-amber-400"
                />
                <KpiCard
                    label="SKUs sin movimiento (30d)"
                    value={kpis.skus_dead.toLocaleString("en-US")}
                    icon={ArchiveX}
                    accentColor="text-rose-600 dark:text-rose-400"
                />
                <KpiCard
                    label="Valor de inventario"
                    value={formatCents(kpis.inventory_value * 100)}
                    icon={DollarSign}
                    accentColor="text-emerald-600 dark:text-emerald-400"
                />
            </div>

            <SectionCard title="Stock bajo" subtitle={`${lowStock.length} SKUs en o bajo el mínimo configurado`}>
                <DataTable
                    rows={lowStock}
                    rowKey={(r) => r.product_id}
                    emptyLabel="Ningún SKU en stock bajo. ¡Buen trabajo!"
                    columns={[
                        { header: "SKU", accessor: (r) => r.sku ?? "—" },
                        { header: "Producto", accessor: (r) => r.name },
                        { header: "Categoría", accessor: (r) => r.category ?? "—" },
                        { header: "Stock actual", accessor: (r) => Number(r.current_stock).toLocaleString("en-US", { maximumFractionDigits: 2 }), align: "right" },
                        { header: "Mínimo", accessor: (r) => Number(r.min_stock).toLocaleString("en-US", { maximumFractionDigits: 2 }), align: "right" },
                        { header: "Vendido (30d)", accessor: (r) => Number(r.units_sold_30d).toLocaleString("en-US", { maximumFractionDigits: 0 }), align: "right" },
                    ]}
                />
            </SectionCard>

            <SectionCard title="Inventario muerto" subtitle="SKUs con stock pero 0 ventas en los últimos 30 días">
                <DataTable
                    rows={deadStock}
                    rowKey={(r) => r.product_id}
                    emptyLabel="Sin inventario muerto detectado."
                    columns={[
                        { header: "SKU", accessor: (r) => r.sku ?? "—" },
                        { header: "Producto", accessor: (r) => r.name },
                        { header: "Stock", accessor: (r) => Number(r.current_stock).toLocaleString("en-US", { maximumFractionDigits: 2 }), align: "right" },
                        { header: "Valor inmovilizado", accessor: (r) => formatCents(Number(r.inventory_value) * 100), align: "right" },
                        { header: "Última venta", accessor: (r) => r.last_sold_at ? new Date(r.last_sold_at).toLocaleDateString("es-PA") : "Nunca", align: "right" },
                    ]}
                />
            </SectionCard>

            <SectionCard title="Top valor de inventario" subtitle="SKUs con mayor capital inmovilizado">
                <DataTable
                    rows={valueRows}
                    rowKey={(r) => r.product_id}
                    columns={[
                        { header: "#", accessor: (_, i) => `${i + 1}`, width: "w-10" },
                        { header: "SKU", accessor: (r) => r.sku ?? "—" },
                        { header: "Producto", accessor: (r) => r.name },
                        { header: "Stock", accessor: (r) => Number(r.current_stock).toLocaleString("en-US", { maximumFractionDigits: 2 }), align: "right" },
                        { header: "Costo unit.", accessor: (r) => formatCents(Number(r.purchase_price) * 100), align: "right" },
                        { header: "Valor", accessor: (r) => formatCents(Number(r.inventory_value) * 100), align: "right" },
                    ]}
                />
            </SectionCard>
        </div>
    )
}
