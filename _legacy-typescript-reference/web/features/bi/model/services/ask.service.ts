/**
 * AskService — Q&A en lenguaje natural sobre los datos del cliente.
 *
 * Estrategia "intent + dispatcher" — no exponemos el SQL al modelo.
 *   1. El modelo recibe la pregunta del usuario y un menú de
 *      "intents" canónicos con los parámetros que aceptan.
 *   2. Devuelve JSON estructurado: { intent, params }.
 *   3. El dispatcher ejecuta queries seguras contra las vistas
 *      materializadas y devuelve el resultado tabular.
 *   4. Una segunda pasada por el modelo redacta una respuesta
 *      concisa en español sobre el resultado.
 *
 * Ventajas vs SQL-libre:
 *   - El modelo no inventa joins ni accede a tablas no permitidas.
 *   - Cada intent es testeable.
 *   - Si el modelo falla devolvemos un mensaje útil ("no entendí").
 */

import { generateObject, generateText } from "ai"
import { z } from "zod"
import { prisma } from "@core/database"
import { aiGateway, AI_MODELS } from "@/lib/ai/gateway"
import { formatCents } from "@/lib/constants/plans"
import { isMissingRelationError } from "./query.service"

export type AskIntent =
    | "sales_total"
    | "sales_by_period"
    | "top_products"
    | "top_customers"
    | "low_stock"
    | "customer_churn"
    | "credit_overdue"
    | "unknown"

const intentSchema = z.object({
    intent: z.enum([
        "sales_total",
        "sales_by_period",
        "top_products",
        "top_customers",
        "low_stock",
        "customer_churn",
        "credit_overdue",
        "unknown",
    ]),
    params: z.object({
        period: z.enum(["today", "7d", "30d", "mtd", "ytd", "all"]).optional(),
        limit: z.number().int().positive().max(50).optional(),
    }).optional(),
})

const SYSTEM_PROMPT = `Eres un asistente que clasifica preguntas de un dueño de negocio sobre su tienda en uno de estos intents:
- "sales_total" — total facturado en un período.
- "sales_by_period" — evolución de ventas día a día.
- "top_products" — productos más vendidos.
- "top_customers" — clientes que más compran.
- "low_stock" — productos con stock bajo.
- "customer_churn" — clientes que dejaron de comprar.
- "credit_overdue" — clientes con crédito vencido.
- "unknown" — si la pregunta no encaja en ningún intent anterior.

Devuelve JSON con el intent y parámetros opcionales (period: today | 7d | 30d | mtd | ytd | all; limit: 1..50).
Si la pregunta no es clara, devuelve "unknown".`

export interface AskAnswer {
    intent: AskIntent
    summary: string
    rows: Array<Record<string, unknown>>
}

export class AskService {
    async ask(clientId: string, question: string): Promise<AskAnswer> {
        // 1) Clasificar intent
        let intent: AskIntent = "unknown"
        let params: { period?: string; limit?: number } = {}
        try {
            const { object } = await generateObject({
                model: aiGateway(AI_MODELS.suggest),
                system: SYSTEM_PROMPT,
                schema: intentSchema,
                prompt: question,
            })
            intent = object.intent
            params = object.params ?? {}
        } catch (err) {
            console.error("[AskService] intent classification", err)
            return {
                intent: "unknown",
                summary: "No pude entender tu pregunta. Intenta reformularla, ej: '¿cuánto vendí esta semana?'",
                rows: [],
            }
        }

        // 2) Ejecutar query según intent
        const rows = await this.dispatch(clientId, intent, params)

        // 3) Redactar respuesta natural
        const summary = await this.summarize(question, intent, rows)

        return { intent, summary, rows }
    }

    private async dispatch(
        clientId: string,
        intent: AskIntent,
        params: { period?: string; limit?: number },
    ): Promise<Array<Record<string, unknown>>> {
        const limit = params.limit ?? 5
        const range = resolvePeriodRange(params.period ?? "30d")

        try {
            return await this.dispatchInner(clientId, intent, params, limit, range)
        } catch (err) {
            if (isMissingRelationError(err)) {
                console.warn("[BI ask] vista BI no existe — devolviendo vacío")
                return []
            }
            throw err
        }
    }

    private async dispatchInner(
        clientId: string,
        intent: AskIntent,
        params: { period?: string; limit?: number },
        limit: number,
        range: { from: string; to: string },
    ): Promise<Array<Record<string, unknown>>> {
        void params
        switch (intent) {
            case "sales_total": {
                const rows = (await prisma.$queryRawUnsafe(
                    `SELECT COALESCE(SUM(total_sales),0)::float AS total,
                            COALESCE(SUM(total_invoices),0)::int AS invoices
                     FROM "mv_bi_sales_daily"
                     WHERE client_id = $1 AND day BETWEEN $2::date AND $3::date`,
                    clientId, range.from, range.to,
                )) as Array<Record<string, unknown>>
                return rows
            }
            case "sales_by_period": {
                const rows = (await prisma.$queryRawUnsafe(
                    `SELECT day::text AS day, total_sales::float AS sales, total_invoices::int AS invoices
                     FROM "mv_bi_sales_daily"
                     WHERE client_id = $1 AND day BETWEEN $2::date AND $3::date
                     ORDER BY day ASC`,
                    clientId, range.from, range.to,
                )) as Array<Record<string, unknown>>
                return rows
            }
            case "top_products": {
                const rows = (await prisma.$queryRawUnsafe(
                    `SELECT code AS sku, description AS name,
                            gross_sales::float AS sales,
                            units_sold::float AS units
                     FROM "mv_bi_product_performance"
                     WHERE client_id = $1
                     ORDER BY gross_sales DESC
                     LIMIT ${limit}`,
                    clientId,
                )) as Array<Record<string, unknown>>
                return rows
            }
            case "top_customers": {
                const rows = (await prisma.$queryRawUnsafe(
                    `SELECT name, total_spent::float AS total, total_invoices::int AS invoices
                     FROM "mv_bi_customer_summary"
                     WHERE client_id = $1
                     ORDER BY total_spent DESC
                     LIMIT ${limit}`,
                    clientId,
                )) as Array<Record<string, unknown>>
                return rows
            }
            case "low_stock": {
                const rows = (await prisma.$queryRawUnsafe(
                    `SELECT sku, name, current_stock::float AS stock,
                            min_stock::float AS min_stock
                     FROM "mv_bi_inventory_snapshot"
                     WHERE client_id = $1 AND is_low_stock = true
                     ORDER BY current_stock ASC
                     LIMIT ${limit}`,
                    clientId,
                )) as Array<Record<string, unknown>>
                return rows
            }
            case "customer_churn": {
                const rows = (await prisma.$queryRawUnsafe(
                    `SELECT name,
                            total_spent::float AS total_spent,
                            EXTRACT(DAY FROM NOW() - last_purchase_at)::int AS days_since_last
                     FROM "mv_bi_customer_summary"
                     WHERE client_id = $1
                       AND last_purchase_at IS NOT NULL
                       AND EXTRACT(DAY FROM NOW() - last_purchase_at) >= 60
                     ORDER BY total_spent DESC
                     LIMIT ${limit}`,
                    clientId,
                )) as Array<Record<string, unknown>>
                return rows
            }
            case "credit_overdue": {
                const rows = (await prisma.$queryRawUnsafe(
                    `SELECT name, current_balance_cents::float AS balance_cents,
                            utilization_pct::float AS util,
                            status
                     FROM "mv_bi_credit_aging"
                     WHERE client_id = $1
                       AND status IN ('OVERDUE', 'OVER_LIMIT')
                     ORDER BY current_balance_cents DESC
                     LIMIT ${limit}`,
                    clientId,
                )) as Array<Record<string, unknown>>
                return rows
            }
            default:
                return []
        }
    }

    private async summarize(
        question: string,
        intent: AskIntent,
        rows: Array<Record<string, unknown>>,
    ): Promise<string> {
        if (intent === "unknown" || rows.length === 0) {
            return "No encontré datos suficientes para responder esa pregunta con tu histórico actual."
        }
        try {
            const preview = JSON.stringify(rows.slice(0, 10), bigintReplacer)
            const { text } = await generateText({
                model: aiGateway(AI_MODELS.support),
                system: `Responde en español, máximo 3 oraciones, lenguaje claro de dueño de negocio. Usa formato monetario en B/. (balboas) cuando aplique. Sé directo y específico — usa los números de las filas.`,
                prompt: `Pregunta: "${question}"\nIntent: ${intent}\nDatos:\n${preview}\n\nResponde directo y conciso.`,
            })
            return text.trim()
        } catch {
            return summarizeFallback(intent, rows)
        }
    }
}

// ---------- helpers ----------

function resolvePeriodRange(period: string): { from: string; to: string } {
    const today = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const to = iso(today)
    if (period === "today") return { from: to, to }
    if (period === "7d") {
        const d = new Date(today); d.setDate(today.getDate() - 6); return { from: iso(d), to }
    }
    if (period === "30d") {
        const d = new Date(today); d.setDate(today.getDate() - 29); return { from: iso(d), to }
    }
    if (period === "mtd") {
        return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to }
    }
    if (period === "ytd") {
        return { from: iso(new Date(today.getFullYear(), 0, 1)), to }
    }
    // "all" o desconocido — últimos 12 meses
    const d = new Date(today); d.setFullYear(today.getFullYear() - 1); return { from: iso(d), to }
}

function summarizeFallback(intent: AskIntent, rows: Array<Record<string, unknown>>): string {
    if (intent === "sales_total") {
        const total = Number(rows[0]?.total ?? 0)
        const inv = Number(rows[0]?.invoices ?? 0)
        return `Llevas ${formatCents(total * 100)} en ${inv} facturas.`
    }
    return `Encontré ${rows.length} resultados.`
}

function bigintReplacer(_key: string, value: unknown) {
    if (typeof value === "bigint") return Number(value)
    return value
}
