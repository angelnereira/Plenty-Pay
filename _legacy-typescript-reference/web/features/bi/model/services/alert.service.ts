/**
 * AlertService — evalúa BIAlert.kind = "THRESHOLD" y dispara
 * notificaciones cuando una métrica cruza el umbral configurado.
 *
 * Las alertas tipo "ANOMALY" (3σ vs media móvil) llegan en Fase 4.
 *
 * Cooldown: si una alerta disparó en las últimas 24h, no la
 * disparamos de nuevo aunque siga rota. Esto evita spam cuando una
 * caída de ventas persiste varios días.
 */

import { prisma } from "@core/database"
import type { BIAlert } from "@prisma/client"
import { BIQueryService } from "./query.service"
import { isMeasureId } from "../measures"
import type { MeasureId } from "../types/bi.types"

const COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24h

export type ThresholdOp = "lt" | "lte" | "gt" | "gte" | "eq"
export type ThresholdPeriod = "today" | "7d" | "30d"

export interface ThresholdConfig {
    metric: MeasureId
    op: ThresholdOp
    value: number
    period: ThresholdPeriod
}

export interface AlertEvaluation {
    alertId: string
    clientId: string
    fired: boolean
    skippedDueToCooldown: boolean
    currentValue: number | null
    config: ThresholdConfig
}

export class AlertService {
    private query = new BIQueryService()

    isValidConfig(config: unknown): config is ThresholdConfig {
        if (!config || typeof config !== "object") return false
        const c = config as Record<string, unknown>
        return (
            typeof c.metric === "string" &&
            isMeasureId(c.metric) &&
            ["lt", "lte", "gt", "gte", "eq"].includes(String(c.op)) &&
            typeof c.value === "number" &&
            Number.isFinite(c.value) &&
            ["today", "7d", "30d"].includes(String(c.period))
        )
    }

    /** Computa la métrica configurada para el período de la alerta. */
    private async computeMetric(alert: BIAlert): Promise<number | null> {
        const config = alert.config as unknown as ThresholdConfig
        const today = new Date()
        const iso = (d: Date) => d.toISOString().slice(0, 10)
        let from: string
        const to = iso(today)
        switch (config.period) {
            case "today": from = to; break
            case "7d": {
                const d = new Date(today); d.setDate(today.getDate() - 6); from = iso(d); break
            }
            case "30d": {
                const d = new Date(today); d.setDate(today.getDate() - 29); from = iso(d); break
            }
        }
        const res = await this.query.run(
            { measures: [config.metric], dateRange: { from, to } },
            { clientId: alert.clientId },
        )
        const raw = res.rows[0]?.[config.metric]
        if (raw == null) return 0
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
    }

    private compare(value: number, op: ThresholdOp, target: number): boolean {
        switch (op) {
            case "lt":  return value < target
            case "lte": return value <= target
            case "gt":  return value > target
            case "gte": return value >= target
            case "eq":  return value === target
        }
    }

    /** Evalúa una alerta y dispara notificación si corresponde. */
    async evaluate(alert: BIAlert): Promise<AlertEvaluation> {
        const config = alert.config as unknown as ThresholdConfig
        if (!this.isValidConfig(config)) {
            return {
                alertId: alert.id,
                clientId: alert.clientId,
                fired: false,
                skippedDueToCooldown: false,
                currentValue: null,
                config,
            }
        }
        // Cooldown
        if (alert.lastFiredAt && Date.now() - alert.lastFiredAt.getTime() < COOLDOWN_MS) {
            return {
                alertId: alert.id,
                clientId: alert.clientId,
                fired: false,
                skippedDueToCooldown: true,
                currentValue: null,
                config,
            }
        }
        const value = await this.computeMetric(alert)
        if (value == null) {
            return {
                alertId: alert.id,
                clientId: alert.clientId,
                fired: false,
                skippedDueToCooldown: false,
                currentValue: null,
                config,
            }
        }
        const fired = this.compare(value, config.op, config.value)
        if (fired) {
            await this.notify(alert, value, config)
            await prisma.bIAlert.update({
                where: { id: alert.id },
                data: { lastFiredAt: new Date() },
            })
        }
        return {
            alertId: alert.id,
            clientId: alert.clientId,
            fired,
            skippedDueToCooldown: false,
            currentValue: value,
            config,
        }
    }

    /** Crea Notification en la inbox de cada usuario del client. */
    private async notify(alert: BIAlert, currentValue: number, config: ThresholdConfig) {
        const users = await prisma.user.findMany({
            where: { clientId: alert.clientId, isActive: true, role: "CLIENT" },
            select: { id: true },
        })
        if (users.length === 0) return
        const opLabel = OP_LABEL[config.op]
        const message = `Métrica "${MEASURE_LABEL[config.metric] ?? config.metric}" actualmente en ${formatValue(currentValue, config.metric)} (umbral: ${opLabel} ${formatValue(config.value, config.metric)} en ${PERIOD_LABEL[config.period]}).`
        await prisma.notification.createMany({
            data: users.map((u) => ({
                userId: u.id,
                // El enum NotificationType no tiene BI_ALERT — usamos
                // SYSTEM_ALERT que es semánticamente lo correcto. El título
                // ya identifica que es una alerta BI.
                type: "SYSTEM_ALERT" as const,
                title: `🔔 Alerta BI: ${alert.name}`,
                message,
                link: "/dashboard/bi/alerts",
                read: false,
            })),
            skipDuplicates: true,
        })
    }

    /** Cron entry-point: recorre todas las alertas activas y evalúa. */
    async evaluateAllActive(): Promise<{ total: number; fired: number; cooldown: number }> {
        const alerts = await prisma.bIAlert.findMany({
            where: { isActive: true, kind: "THRESHOLD" },
            // Solo evaluamos clientes con BI activo (un addon desactivado
            // no debería seguir disparando alertas).
            include: {
                client: { select: { biEnabled: true, biProEnabled: true } },
            },
        })
        let fired = 0
        let cooldown = 0
        for (const a of alerts) {
            if (!a.client.biEnabled && !a.client.biProEnabled) continue
            const ev = await this.evaluate(a)
            if (ev.fired) fired++
            if (ev.skippedDueToCooldown) cooldown++
        }
        return { total: alerts.length, fired, cooldown }
    }
}

// ---------- helpers de presentación ----------

const OP_LABEL: Record<ThresholdOp, string> = {
    lt: "menor que", lte: "menor o igual que",
    gt: "mayor que", gte: "mayor o igual que",
    eq: "igual a",
}

const PERIOD_LABEL: Record<ThresholdPeriod, string> = {
    today: "hoy",
    "7d": "últimos 7 días",
    "30d": "últimos 30 días",
}

const MEASURE_LABEL: Partial<Record<MeasureId, string>> = {
    sales_total: "Ventas",
    invoice_count: "Facturas",
    ticket_avg: "Ticket promedio",
    units_sold: "Unidades vendidas",
    gross_sales: "Ventas brutas",
    discounts: "Descuentos",
    unique_customers: "Clientes únicos",
    sales_subtotal: "Subtotal",
}

function formatValue(value: number, metric: MeasureId): string {
    // currency vs count/percentage — usamos las pistas del catálogo de measures.
    const currencyMetrics: MeasureId[] = ["sales_total", "sales_subtotal", "ticket_avg", "gross_sales", "discounts"]
    if (currencyMetrics.includes(metric)) {
        return `B/. ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}
