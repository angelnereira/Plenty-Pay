import { type NextRequest, NextResponse } from "next/server"
import { AlertService } from "@/features/bi"
import { withSentryCron } from "@/lib/sentry/cron-wrapper"

/**
 * GET /api/cron/bi-alerts
 *
 * Recorre todas las BIAlert activas (kind THRESHOLD), evalúa cada una
 * y dispara notificaciones cuando la métrica cruza el umbral.
 *
 * Cooldown 24h por alerta — definido en AlertService.
 *
 * Schedule en vercel.json: cada hora (un cliente que pone una alerta
 * de "ventas hoy < $X" la ve actualizada cada hora).
 *
 * Auth: Bearer CRON_SECRET (mismo patrón que el resto de crons).
 */
const handler = async (req: NextRequest) => {
    const authHeader = req.headers.get("authorization")
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    const startedAt = Date.now()
    try {
        const service = new AlertService()
        const result = await service.evaluateAllActive()
        return NextResponse.json({
            success: true,
            durationMs: Date.now() - startedAt,
            ...result,
        })
    } catch (error) {
        console.error("[bi-alerts] error", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 },
        )
    }
}

export const GET = withSentryCron(
    "bi-alerts",
    { schedule: "0 * * * *", maxRuntimeSeconds: 60 },
    handler as unknown as (request: NextRequest) => Promise<NextResponse>,
)
