/**
 * Repositorio dedicado para las vistas de Fase 1.5 (Inventario y
 * Créditos). Las vistas nuevas no se exponen via DSL — sus dashboards
 * son fijos, así que las consultamos con SQL crudo paramétrico.
 *
 * Toda query exige clientId del contexto del servidor (jamás del body).
 */

import { prisma } from "@core/database"
import { isMissingRelationError } from "../services/query.service"

/** Envuelve una query SQL y devuelve `fallback` si la vista no existe. */
async function safeQuery<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
    try {
        return await fn()
    } catch (err) {
        if (isMissingRelationError(err)) {
            console.warn(
                `[BI] vista "${label}" no existe — devolviendo vacío. ` +
                `Corre "node scripts/apply-bi-views.js" para crearla.`,
            )
            return fallback
        }
        throw err
    }
}

// ============================================
// Inventario
// ============================================

export interface InventorySnapshotRow {
    product_id: string
    sku: string | null
    name: string
    category: string | null
    current_stock: number
    min_stock: number
    sale_price: number
    purchase_price: number
    inventory_value: number
    units_sold_30d: number
    sales_30d: number
    last_sold_at: Date | null
    days_since_last_sale: number | null
    is_low_stock: boolean
    is_dead_stock: boolean
}

export interface InventoryKpis {
    skus_total: number
    skus_low: number
    skus_dead: number
    inventory_value: number
}

export async function getInventoryKpis(clientId: string): Promise<InventoryKpis> {
    return safeQuery(
        async () => {
            const rows = (await prisma.$queryRawUnsafe(
                `SELECT
                    COUNT(*)::int                                                                  AS skus_total,
                    SUM(CASE WHEN is_low_stock THEN 1 ELSE 0 END)::int                             AS skus_low,
                    SUM(CASE WHEN is_dead_stock THEN 1 ELSE 0 END)::int                            AS skus_dead,
                    COALESCE(SUM(inventory_value), 0)::numeric(14,2)                               AS inventory_value
                 FROM "mv_bi_inventory_snapshot"
                 WHERE client_id = $1`,
                clientId,
            )) as Array<Record<string, unknown>>
            const r = rows[0] ?? {}
            return {
                skus_total: Number(r.skus_total ?? 0),
                skus_low: Number(r.skus_low ?? 0),
                skus_dead: Number(r.skus_dead ?? 0),
                inventory_value: Number(r.inventory_value ?? 0),
            }
        },
        { skus_total: 0, skus_low: 0, skus_dead: 0, inventory_value: 0 },
        "mv_bi_inventory_snapshot",
    )
}

export async function getInventorySnapshot(
    clientId: string,
    opts: { limit?: number; orderBy?: "value" | "low" | "dead" | "rotation" } = {},
): Promise<InventorySnapshotRow[]> {
    const limit = Math.max(1, Math.min(500, opts.limit ?? 100))
    let orderClause = "ORDER BY inventory_value DESC NULLS LAST"
    if (opts.orderBy === "low") orderClause = "ORDER BY is_low_stock DESC, current_stock ASC"
    if (opts.orderBy === "dead") orderClause = "ORDER BY is_dead_stock DESC, days_since_last_sale DESC NULLS LAST"
    if (opts.orderBy === "rotation") orderClause = "ORDER BY units_sold_30d DESC NULLS LAST"

    return safeQuery(
        async () => (await prisma.$queryRawUnsafe(
            `SELECT product_id, sku, name, category, current_stock, min_stock,
                    sale_price, purchase_price, inventory_value,
                    units_sold_30d, sales_30d, last_sold_at, days_since_last_sale,
                    is_low_stock, is_dead_stock
             FROM "mv_bi_inventory_snapshot"
             WHERE client_id = $1
             ${orderClause}
             LIMIT ${limit}`,
            clientId,
        )) as InventorySnapshotRow[],
        [],
        "mv_bi_inventory_snapshot",
    )
}

// ============================================
// Créditos
// ============================================

export type CreditStatus = "HEALTHY" | "WARNING" | "OVER_LIMIT" | "OVERDUE"

export interface CreditAgingRow {
    entity_id: string
    name: string
    document: string | null
    credit_limit_cents: bigint | number
    current_balance_cents: bigint | number
    utilization_pct: number
    last_movement_at: Date | null
    days_since_last_movement: number | null
    payment_due_at: Date | null
    is_overdue: boolean
    status: CreditStatus
}

export interface CreditKpis {
    entities_total: number
    healthy: number
    warning: number
    over_limit: number
    overdue: number
    total_outstanding_cents: number
    total_limit_cents: number
}

export async function getCreditKpis(clientId: string): Promise<CreditKpis> {
    return safeQuery(
        async () => {
            const rows = (await prisma.$queryRawUnsafe(
                `SELECT
                    COUNT(*)::int                                                  AS entities_total,
                    SUM(CASE WHEN status = 'HEALTHY'    THEN 1 ELSE 0 END)::int    AS healthy,
                    SUM(CASE WHEN status = 'WARNING'    THEN 1 ELSE 0 END)::int    AS warning,
                    SUM(CASE WHEN status = 'OVER_LIMIT' THEN 1 ELSE 0 END)::int    AS over_limit,
                    SUM(CASE WHEN status = 'OVERDUE'    THEN 1 ELSE 0 END)::int    AS overdue,
                    COALESCE(SUM(current_balance_cents), 0)::bigint                AS total_outstanding_cents,
                    COALESCE(SUM(credit_limit_cents), 0)::bigint                   AS total_limit_cents
                 FROM "mv_bi_credit_aging"
                 WHERE client_id = $1`,
                clientId,
            )) as Array<Record<string, unknown>>
            const r = rows[0] ?? {}
            return {
                entities_total: Number(r.entities_total ?? 0),
                healthy: Number(r.healthy ?? 0),
                warning: Number(r.warning ?? 0),
                over_limit: Number(r.over_limit ?? 0),
                overdue: Number(r.overdue ?? 0),
                total_outstanding_cents: Number(r.total_outstanding_cents ?? 0),
                total_limit_cents: Number(r.total_limit_cents ?? 0),
            }
        },
        { entities_total: 0, healthy: 0, warning: 0, over_limit: 0, overdue: 0, total_outstanding_cents: 0, total_limit_cents: 0 },
        "mv_bi_credit_aging",
    )
}

export async function getCreditAging(
    clientId: string,
    opts: { limit?: number; status?: CreditStatus | "ALL" } = {},
): Promise<CreditAgingRow[]> {
    const limit = Math.max(1, Math.min(500, opts.limit ?? 100))
    const params: unknown[] = [clientId]
    let where = `WHERE client_id = $1`
    if (opts.status && opts.status !== "ALL") {
        params.push(opts.status)
        where += ` AND status = $2`
    }
    return safeQuery(
        async () => (await prisma.$queryRawUnsafe(
            `SELECT entity_id, name, document, credit_limit_cents, current_balance_cents,
                    utilization_pct, last_movement_at, days_since_last_movement,
                    payment_due_at, is_overdue, status
             FROM "mv_bi_credit_aging"
             ${where}
             ORDER BY current_balance_cents DESC
             LIMIT ${limit}`,
            ...params,
        )) as CreditAgingRow[],
        [],
        "mv_bi_credit_aging",
    )
}
