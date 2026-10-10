/**
 * SegmentService — recálculo de segmentos guardados.
 *
 * El cliente define reglas como:
 *   { entity: "customer", rules: [
 *     { field: "lastPurchaseDaysAgo", op: "gte", value: 60 },
 *     { field: "totalSpentLast12mo",  op: "gte", value: 500 }
 *   ]}
 *
 * El servicio resuelve cada regla contra mv_bi_customer_summary
 * (campos derivados como days_since_last_purchase los calcula al
 * vuelo). Devuelve la lista de customer_id que califican y persiste
 * el count en cachedCount + refreshedAt.
 */

import { prisma } from "@core/database"
import type { BISavedSegment } from "@prisma/client"
import { isMissingRelationError } from "./query.service"

export type SegmentField =
    | "totalSpent"
    | "totalInvoices"
    | "ticketAvg"
    | "lastPurchaseDaysAgo"

export type SegmentOp = "lt" | "lte" | "gt" | "gte" | "eq"

export interface SegmentRule {
    field: SegmentField
    op: SegmentOp
    value: number
}

export interface SegmentDefinition {
    entity: "customer"
    rules: SegmentRule[]
}

const FIELD_TO_SQL: Record<SegmentField, string> = {
    totalSpent:           "total_spent",
    totalInvoices:        "total_invoices",
    ticketAvg:            "ticket_avg",
    lastPurchaseDaysAgo:  "EXTRACT(DAY FROM NOW() - last_purchase_at)::int",
}

const OP_SQL: Record<SegmentOp, string> = {
    lt: "<", lte: "<=", gt: ">", gte: ">=", eq: "=",
}

export interface SegmentMember {
    customer_id: string | null
    name: string
    total_spent: number
    total_invoices: number
    ticket_avg: number
    last_purchase_at: Date | null
    days_since_last_purchase: number | null
}

export class SegmentService {
    /** Devuelve los miembros que califican y los cuenta. */
    async resolve(clientId: string, def: SegmentDefinition, opts: { limit?: number } = {}): Promise<SegmentMember[]> {
        const limit = Math.max(1, Math.min(2000, opts.limit ?? 1000))
        const conditions = def.rules.map((r) => {
            const col = FIELD_TO_SQL[r.field]
            const op = OP_SQL[r.op]
            // value es number — interpolación segura (Number())
            const v = Number(r.value)
            return `(${col}) ${op} ${v}`
        }).join(" AND ")
        const where = conditions ? `AND ${conditions}` : ""

        try {
            const rows = (await prisma.$queryRawUnsafe(
                `SELECT customer_id, name, total_spent::float AS total_spent,
                        total_invoices, ticket_avg::float AS ticket_avg,
                        last_purchase_at,
                        EXTRACT(DAY FROM NOW() - last_purchase_at)::int AS days_since_last_purchase
                 FROM "mv_bi_customer_summary"
                 WHERE client_id = $1
                   ${where}
                 ORDER BY total_spent DESC
                 LIMIT ${limit}`,
                clientId,
            )) as SegmentMember[]
            return rows
        } catch (err) {
            if (isMissingRelationError(err)) {
                console.warn("[BI segments] vista mv_bi_customer_summary no existe — devolviendo vacío")
                return []
            }
            throw err
        }
    }

    async refreshCount(segment: BISavedSegment): Promise<number> {
        const def = segment.rules as unknown as SegmentDefinition
        if (!def.rules || !Array.isArray(def.rules)) return 0
        const members = await this.resolve(segment.clientId, { entity: "customer", rules: def.rules }, { limit: 2000 })
        await prisma.bISavedSegment.update({
            where: { id: segment.id },
            data: { cachedCount: members.length, refreshedAt: new Date() },
        })
        return members.length
    }

    /** Recálcula counts de todos los segmentos del cliente. */
    async refreshAllForClient(clientId: string): Promise<{ updated: number }> {
        const segments = await prisma.bISavedSegment.findMany({ where: { clientId } })
        for (const s of segments) {
            await this.refreshCount(s)
        }
        return { updated: segments.length }
    }

    /**
     * Genera 4 segmentos pre-definidos al estilo RFM simplificado:
     *   - Champions       : compraron en últimos 30d Y gastaron >= $500
     *   - At Risk         : no compran en 60d pero gastaron >= $500 histórico
     *   - Hibernating     : no compran en 90d
     *   - Big Spenders    : ticket promedio >= $200
     *
     * Devuelve cuántos clientes caen en cada uno (sin persistirlos).
     */
    async previewRFM(clientId: string): Promise<Array<{ key: string; label: string; count: number; rule: SegmentDefinition }>> {
        const buckets: Array<{ key: string; label: string; rule: SegmentDefinition }> = [
            {
                key: "champions",
                label: "Champions",
                rule: {
                    entity: "customer",
                    rules: [
                        { field: "lastPurchaseDaysAgo", op: "lte", value: 30 },
                        { field: "totalSpent", op: "gte", value: 500 },
                    ],
                },
            },
            {
                key: "at_risk",
                label: "At Risk",
                rule: {
                    entity: "customer",
                    rules: [
                        { field: "lastPurchaseDaysAgo", op: "gte", value: 60 },
                        { field: "totalSpent", op: "gte", value: 500 },
                    ],
                },
            },
            {
                key: "hibernating",
                label: "Hibernating",
                rule: {
                    entity: "customer",
                    rules: [{ field: "lastPurchaseDaysAgo", op: "gte", value: 90 }],
                },
            },
            {
                key: "big_spenders",
                label: "Big Spenders",
                rule: {
                    entity: "customer",
                    rules: [{ field: "ticketAvg", op: "gte", value: 200 }],
                },
            },
        ]
        const out = []
        for (const b of buckets) {
            const members = await this.resolve(clientId, b.rule, { limit: 2000 })
            out.push({ ...b, count: members.length })
        }
        return out
    }
}
