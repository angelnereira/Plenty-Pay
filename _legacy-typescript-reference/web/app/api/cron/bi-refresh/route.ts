import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@core/database"
import { withSentryCron } from "@/lib/sentry/cron-wrapper"

/**
 * GET /api/cron/bi-refresh
 *
 * Refresca las vistas materializadas del módulo BI invocando
 * `refresh_bi_views()` (definida en la migración 20260510130000_bi_essential).
 *
 * Las vistas usan `REFRESH MATERIALIZED VIEW CONCURRENTLY` (cada vista
 * tiene un UNIQUE INDEX requerido), por lo que el refresh no bloquea las
 * lecturas en curso.
 *
 * Schedule en vercel.json: cada 30 minutos (mantiene Resumen y top lists
 * cerca del tiempo real sin saturar el plan de DB).
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
        await prisma.$executeRawUnsafe("SELECT refresh_bi_views()")
        const durationMs = Date.now() - startedAt
        return NextResponse.json({
            success: true,
            durationMs,
            timestamp: new Date().toISOString(),
        })
    } catch (error) {
        console.error("[bi-refresh] error", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Error desconocido" },
            { status: 500 },
        )
    }
}

export const GET = withSentryCron(
    "bi-refresh",
    { schedule: "*/30 * * * *", maxRuntimeSeconds: 60 },
    handler as unknown as (request: NextRequest) => Promise<NextResponse>,
)
