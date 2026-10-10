/**
 * CohortService — análisis de retención por cohorte mensual.
 *
 * Para cada cliente que hizo su primera compra en mes M, calculamos
 * cuántos siguen comprando en los meses M+1, M+2, ... M+11.
 *
 * Resultado: matriz cohort × delta donde cada celda es la cantidad
 * de clientes activos. La UI lo renderiza como heatmap.
 */

import { prisma } from "@core/database"

export interface CohortRow {
    cohort: string         // YYYY-MM (mes de primera compra)
    cohortSize: number     // total de clientes en la cohorte
    /** Retención por mes relativo. Index 0 = mes de adquisición (siempre = cohortSize). */
    retention: number[]
}

export interface CohortMatrix {
    cohorts: CohortRow[]
    /** Cuántos meses hacia adelante medir (0..N). */
    horizon: number
}

export class CohortService {
    async compute(clientId: string, opts: { months?: number } = {}): Promise<CohortMatrix> {
        const months = Math.max(3, Math.min(24, opts.months ?? 12))

        // 1) Obtenemos primer mes de compra por customer_id
        const firstRows = (await prisma.$queryRawUnsafe(
            `SELECT i."customerId" AS customer_id,
                    TO_CHAR(MIN(i."issueDate"), 'YYYY-MM') AS first_month
             FROM "invoices" i
             WHERE i."clientId" = $1
               AND i."status" IN ('EMITTED', 'CERTIFIED', 'INTERNAL')
               AND i."documentType" = 'FACTURA'
               AND i."customerId" IS NOT NULL
               AND i."issueDate" >= (NOW() - INTERVAL '${months + 1} months')::date
             GROUP BY i."customerId"`,
            clientId,
        )) as Array<{ customer_id: string; first_month: string }>

        // 2) Obtenemos meses de actividad por customer_id
        const activityRows = (await prisma.$queryRawUnsafe(
            `SELECT i."customerId" AS customer_id,
                    TO_CHAR(DATE_TRUNC('month', i."issueDate"), 'YYYY-MM') AS month
             FROM "invoices" i
             WHERE i."clientId" = $1
               AND i."status" IN ('EMITTED', 'CERTIFIED', 'INTERNAL')
               AND i."documentType" = 'FACTURA'
               AND i."customerId" IS NOT NULL
               AND i."issueDate" >= (NOW() - INTERVAL '${months + 1} months')::date
             GROUP BY i."customerId", DATE_TRUNC('month', i."issueDate")`,
            clientId,
        )) as Array<{ customer_id: string; month: string }>

        // Mapeo customer_id → first_month
        const firstByCustomer = new Map<string, string>()
        for (const r of firstRows) firstByCustomer.set(r.customer_id, r.first_month)

        // Cohort sizes
        const cohortSize = new Map<string, number>()
        for (const r of firstRows) {
            cohortSize.set(r.first_month, (cohortSize.get(r.first_month) ?? 0) + 1)
        }

        // Active sets por (cohort, delta_months)
        const active = new Map<string, Set<string>>() // key: `${cohort}|${delta}`
        for (const r of activityRows) {
            const cohort = firstByCustomer.get(r.customer_id)
            if (!cohort) continue
            const delta = monthsBetween(cohort, r.month)
            if (delta < 0 || delta >= months) continue
            const key = `${cohort}|${delta}`
            if (!active.has(key)) active.set(key, new Set())
            active.get(key)!.add(r.customer_id)
        }

        const cohortKeys = [...cohortSize.keys()].sort()
        const cohorts: CohortRow[] = cohortKeys.map((cohort) => {
            const retention: number[] = []
            for (let d = 0; d < months; d++) {
                retention.push(active.get(`${cohort}|${d}`)?.size ?? 0)
            }
            return { cohort, cohortSize: cohortSize.get(cohort) ?? 0, retention }
        })

        return { cohorts, horizon: months }
    }
}

function monthsBetween(from: string, to: string): number {
    const [fy, fm] = from.split("-").map(Number)
    const [ty, tm] = to.split("-").map(Number)
    return (ty - fy) * 12 + (tm - fm)
}
