/**
 * AnomalyService — detección de anomalías en series diarias.
 *
 * Algoritmo (3-sigma sobre media móvil):
 *   1. Obtenemos los últimos N días de la métrica desde mv_bi_sales_daily.
 *   2. Calculamos media móvil de 14 días y desviación estándar de los
 *      residuos.
 *   3. Cada día con |valor - media| > sensitivity·σ se marca como anomaly.
 *      sensitivity por defecto = 3 (regla 3-sigma estándar).
 *   4. Devolvemos los días anómalos con severidad (low / medium / high)
 *      según cuántas σ se desvían.
 *
 * Esta es una heurística — no requiere ML pesado. Si una caída persiste,
 * los puntos siguientes empiezan a entrar dentro de la nueva media móvil
 * y dejan de ser anomalías; eso es deseable.
 */

import { prisma } from "@core/database"
import { isMissingRelationError } from "./query.service"

export interface AnomalyPoint {
    date: string         // YYYY-MM-DD
    value: number
    expected: number
    deviation: number    // valor - expected
    sigmas: number       // (value - expected) / σ
    severity: "low" | "medium" | "high"
    direction: "spike" | "drop"
}

export type AnomalyMetric = "sales_total" | "invoice_count"

export class AnomalyService {
    /** Detecta anomalías en las últimas N días para una métrica. */
    async detect(
        clientId: string,
        opts: { metric?: AnomalyMetric; days?: number; sensitivity?: number } = {},
    ): Promise<{ points: AnomalyPoint[]; sigma: number; mean: number }> {
        const metric = opts.metric ?? "sales_total"
        const days = Math.max(30, Math.min(180, opts.days ?? 60))
        const sensitivity = opts.sensitivity ?? 3
        const column = metric === "invoice_count" ? "total_invoices" : "total_sales"

        let rows: Array<{ date: string; value: number }>
        try {
            rows = (await prisma.$queryRawUnsafe(
                `SELECT day::text AS date, ${column}::float AS value
                 FROM "mv_bi_sales_daily"
                 WHERE client_id = $1
                   AND day >= (NOW() - INTERVAL '${days} days')::date
                 ORDER BY day ASC`,
                clientId,
            )) as Array<{ date: string; value: number }>
        } catch (err) {
            if (isMissingRelationError(err)) {
                console.warn("[BI anomalies] vista mv_bi_sales_daily no existe — devolviendo vacío")
                return { points: [], sigma: 0, mean: 0 }
            }
            throw err
        }

        if (rows.length < 14) return { points: [], sigma: 0, mean: 0 }

        const values = rows.map((r) => Number(r.value) || 0)
        const movingAvg = this.movingAverage(values, 14)
        const residuals = values.map((v, i) => v - (movingAvg[i] ?? 0))
        const sigma = stddev(residuals)
        const mean = values.reduce((s, v) => s + v, 0) / values.length

        if (sigma === 0) return { points: [], sigma: 0, mean }

        const points: AnomalyPoint[] = []
        rows.forEach((r, i) => {
            const expected = movingAvg[i] ?? mean
            const deviation = values[i] - expected
            const sigmas = Math.abs(deviation) / sigma
            if (sigmas >= sensitivity) {
                const severity: "low" | "medium" | "high" =
                    sigmas >= 4 ? "high" : sigmas >= 3.5 ? "medium" : "low"
                points.push({
                    date: r.date,
                    value: Number(values[i].toFixed(2)),
                    expected: Number(expected.toFixed(2)),
                    deviation: Number(deviation.toFixed(2)),
                    sigmas: Number(sigmas.toFixed(2)),
                    severity,
                    direction: deviation > 0 ? "spike" : "drop",
                })
            }
        })
        // Más recientes primero
        points.reverse()
        return { points, sigma, mean }
    }

    private movingAverage(values: number[], window: number): number[] {
        const out: number[] = []
        for (let i = 0; i < values.length; i++) {
            const start = Math.max(0, i - window + 1)
            const slice = values.slice(start, i + 1)
            out.push(slice.reduce((s, v) => s + v, 0) / slice.length)
        }
        return out
    }
}

function stddev(values: number[]): number {
    if (values.length < 2) return 0
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
}
