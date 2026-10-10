/**
 * BasketService — análisis de canasta (market basket) simplificado.
 *
 * Para cada par (A, B) que aparece junto en al menos N facturas,
 * calculamos:
 *   - support  : pares(A,B) / total_facturas
 *   - confidence(A→B) : pares(A,B) / facturas_con_A
 *   - lift     : confidence / (facturas_con_B / total_facturas)
 *
 * Filtramos lift > 1 y confidence >= minConfidence (configurable).
 *
 * No usamos Apriori real — para tamaños PyME (≤ miles de facturas y
 * cientos de SKUs) la query directa con un join autoreferenciado
 * en SQL es suficiente y más simple.
 */

import { prisma } from "@core/database"

export interface BasketRule {
    a: string
    b: string
    pairCount: number
    support: number       // 0..1
    confidence: number    // 0..1 (A → B)
    lift: number
}

export class BasketService {
    async topPairs(
        clientId: string,
        opts: { minPairCount?: number; minConfidence?: number; limit?: number } = {},
    ): Promise<BasketRule[]> {
        const minPairCount = Math.max(2, opts.minPairCount ?? 3)
        const minConfidence = opts.minConfidence ?? 0.1
        const limit = Math.max(1, Math.min(100, opts.limit ?? 50))

        // Total de facturas elegibles (denominador para support).
        const totalRow = (await prisma.$queryRawUnsafe(
            `SELECT COUNT(*)::int AS total
             FROM "invoices"
             WHERE "clientId" = $1
               AND "status" IN ('EMITTED', 'CERTIFIED', 'INTERNAL')
               AND "documentType" = 'FACTURA'`,
            clientId,
        )) as Array<{ total: number }>
        const totalInvoices = Number(totalRow[0]?.total ?? 0)
        if (totalInvoices < 5) return []

        // Conteo individual por SKU (para confidence/lift).
        const itemCountRows = (await prisma.$queryRawUnsafe(
            `SELECT ii."code" AS code,
                    COUNT(DISTINCT ii."invoiceId")::int AS count
             FROM "invoice_items" ii
             JOIN "invoices" i ON i."id" = ii."invoiceId"
             WHERE i."clientId" = $1
               AND i."status" IN ('EMITTED', 'CERTIFIED', 'INTERNAL')
               AND i."documentType" = 'FACTURA'
             GROUP BY ii."code"`,
            clientId,
        )) as Array<{ code: string; count: number }>
        const itemCount = new Map<string, number>()
        for (const r of itemCountRows) itemCount.set(r.code, Number(r.count))

        // Pares dentro de la misma factura.
        const pairRows = (await prisma.$queryRawUnsafe(
            `SELECT a."code" AS a,
                    b."code" AS b,
                    COUNT(DISTINCT a."invoiceId")::int AS pair_count
             FROM "invoice_items" a
             JOIN "invoice_items" b ON b."invoiceId" = a."invoiceId" AND b."code" > a."code"
             JOIN "invoices" i ON i."id" = a."invoiceId"
             WHERE i."clientId" = $1
               AND i."status" IN ('EMITTED', 'CERTIFIED', 'INTERNAL')
               AND i."documentType" = 'FACTURA'
             GROUP BY a."code", b."code"
             HAVING COUNT(DISTINCT a."invoiceId") >= ${minPairCount}
             ORDER BY pair_count DESC
             LIMIT ${limit * 2}`,
            clientId,
        )) as Array<{ a: string; b: string; pair_count: number }>

        const rules: BasketRule[] = []
        for (const r of pairRows) {
            const a = r.a
            const b = r.b
            const pair = Number(r.pair_count)
            const aCount = itemCount.get(a) ?? 0
            const bCount = itemCount.get(b) ?? 0
            if (aCount === 0 || bCount === 0) continue
            const support = pair / totalInvoices
            const confidence = pair / aCount // A → B
            const lift = confidence / (bCount / totalInvoices)
            if (confidence < minConfidence || lift <= 1) continue
            rules.push({
                a, b, pairCount: pair,
                support: round(support, 4),
                confidence: round(confidence, 4),
                lift: round(lift, 3),
            })
        }
        rules.sort((x, y) => y.lift - x.lift)
        return rules.slice(0, limit)
    }
}

function round(n: number, digits: number): number {
    const f = 10 ** digits
    return Math.round(n * f) / f
}
