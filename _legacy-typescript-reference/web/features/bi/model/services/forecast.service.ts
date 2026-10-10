/**
 * ForecastService — predicción heurística simple basada en histórico
 * de mv_bi_sales_daily.
 *
 * Algoritmo (decididamente humilde, suficiente para PyME):
 *   1. Tomar últimos N días (default 90) de la métrica.
 *   2. Media móvil de 7 días (suaviza ruido día a día).
 *   3. Calcular factor estacional semanal (cuánto vende cada
 *      día de la semana vs el promedio).
 *   4. Para cada día futuro: base = media móvil reciente × factor.
 *   5. Banda de confianza ±1σ del residuo.
 *
 * Si necesitamos más sofisticación en Fase 4 (ARIMA / Prophet):
 *   - swap solo el cómputo, manteniendo el shape del resultado.
 */

import { prisma } from "@core/database"
import type { BIForecast } from "@prisma/client"
import { isMissingRelationError } from "./query.service"

export interface ForecastPoint {
    date: string         // ISO YYYY-MM-DD
    predicted: number
    lower: number
    upper: number
    historical?: boolean // true si es histórico (para el chart)
    actual?: number      // valor real (solo si historical)
}

export type ForecastMetric = "sales_total" | "invoice_count"

export class ForecastService {
    /**
     * Genera y persiste un forecast para `clientId × metric`.
     */
    async computeAndSave(
        clientId: string,
        metric: ForecastMetric,
        opts: { historyDays?: number; horizonDays?: number } = {},
    ): Promise<BIForecast> {
        const historyDays = opts.historyDays ?? 90
        const horizonDays = Math.min(90, Math.max(7, opts.horizonDays ?? 30))

        const series = await this.loadHistory(clientId, metric, historyDays)
        const data = this.forecast(series, horizonDays)

        const created = await prisma.bIForecast.create({
            data: {
                clientId,
                metric,
                granularity: "day",
                data: data as unknown as object,
            },
        })
        return created
    }

    /** Última versión computada del forecast (sin recalcular). */
    async latest(clientId: string, metric: ForecastMetric): Promise<BIForecast | null> {
        return prisma.bIForecast.findFirst({
            where: { clientId, metric, granularity: "day" },
            orderBy: { computedAt: "desc" },
        })
    }

    // -----------------------------------------------------------------
    // Carga histórica desde mv_bi_sales_daily
    // -----------------------------------------------------------------

    private async loadHistory(
        clientId: string,
        metric: ForecastMetric,
        days: number,
    ): Promise<Array<{ date: string; value: number }>> {
        const column = metric === "invoice_count" ? "total_invoices" : "total_sales"
        let rows: Array<{ date: string; value: number | string }>
        try {
            rows = (await prisma.$queryRawUnsafe(
                `SELECT day::text AS date, ${column}::float AS value
                 FROM "mv_bi_sales_daily"
                 WHERE client_id = $1
                   AND day >= (NOW() - INTERVAL '${days} days')::date
                 ORDER BY day ASC`,
                clientId,
            )) as Array<{ date: string; value: number | string }>
        } catch (err) {
            if (isMissingRelationError(err)) {
                console.warn("[BI forecast] vista mv_bi_sales_daily no existe — devolviendo histórico vacío")
                rows = []
            } else {
                throw err
            }
        }

        // Backfill días faltantes con 0
        const map = new Map<string, number>()
        for (const r of rows) {
            map.set(r.date, Number(r.value) || 0)
        }
        const result: Array<{ date: string; value: number }> = []
        const today = new Date()
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(today)
            d.setDate(today.getDate() - i)
            const key = isoDate(d)
            result.push({ date: key, value: map.get(key) ?? 0 })
        }
        return result
    }

    // -----------------------------------------------------------------
    // Forecast — heurística media móvil + estacionalidad semanal
    // -----------------------------------------------------------------

    private forecast(
        series: Array<{ date: string; value: number }>,
        horizonDays: number,
    ): ForecastPoint[] {
        if (series.length === 0) return []

        const window = Math.min(7, series.length)
        const movingAvg = this.movingAverage(series.map((s) => s.value), window)
        const trailingAvg = movingAvg[movingAvg.length - 1] ?? 0

        // Factor estacional por día de la semana (0 = domingo).
        // Si hay <2 semanas de data caemos a 1.0 (sin estacionalidad).
        const seasonal = this.weeklySeasonalFactors(series)

        // Residuo ≈ desviación estándar de las diferencias entre value y avg
        const residuals = series.map((s, i) => Math.abs(s.value - (movingAvg[i] ?? trailingAvg)))
        const sigma = stddev(residuals)

        const points: ForecastPoint[] = series.map((s) => ({
            date: s.date,
            predicted: s.value,
            lower: s.value,
            upper: s.value,
            historical: true,
            actual: s.value,
        }))

        const lastDate = new Date(series[series.length - 1].date + "T00:00:00")
        for (let i = 1; i <= horizonDays; i++) {
            const d = new Date(lastDate)
            d.setDate(lastDate.getDate() + i)
            const dow = d.getDay()
            const factor = seasonal[dow] ?? 1
            const predicted = Math.max(0, trailingAvg * factor)
            points.push({
                date: isoDate(d),
                predicted: round2(predicted),
                lower: round2(Math.max(0, predicted - sigma)),
                upper: round2(predicted + sigma),
            })
        }
        return points
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

    private weeklySeasonalFactors(
        series: Array<{ date: string; value: number }>,
    ): number[] {
        if (series.length < 14) return Array(7).fill(1)
        const sums = Array(7).fill(0)
        const counts = Array(7).fill(0)
        for (const s of series) {
            const dow = new Date(s.date + "T00:00:00").getDay()
            sums[dow] += s.value
            counts[dow] += 1
        }
        const avgPerDow = sums.map((sum, i) => (counts[i] === 0 ? 0 : sum / counts[i]))
        const overallAvg = avgPerDow.reduce((s, v) => s + v, 0) / 7 || 1
        return avgPerDow.map((v) => v / overallAvg)
    }
}

// ---------- helpers ----------

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10)
}

function round2(n: number): number {
    return Math.round(n * 100) / 100
}

function stddev(values: number[]): number {
    if (values.length < 2) return 0
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
}
