import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@core/database"
import { ForecastService, SegmentService } from "@/features/bi"
import { withSentryCron } from "@/lib/sentry/cron-wrapper"

/**
 * GET /api/cron/bi-pro-refresh
 *
 * Cron diario (4 AM) que:
 *   1. Recálcula `cachedCount` de cada BISavedSegment del cliente.
 *   2. Recálcula el forecast de ventas (sales_total, horizonte 30d)
 *      para cada cliente con BI Pro activo.
 *
 * Bearer CRON_SECRET requerido.
 */
const handler = async (req: NextRequest) => {
    const auth = req.headers.get("authorization")
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }
    const startedAt = Date.now()
    try {
        const proClients = await prisma.client.findMany({
            where: { biProEnabled: true },
            select: { id: true },
        })

        const segmentService = new SegmentService()
        const forecastService = new ForecastService()

        let segmentsUpdated = 0
        let forecastsRun = 0
        for (const c of proClients) {
            const r = await segmentService.refreshAllForClient(c.id)
            segmentsUpdated += r.updated
            try {
                await forecastService.computeAndSave(c.id, "sales_total", { horizonDays: 30 })
                forecastsRun++
            } catch (err) {
                console.error("[bi-pro-refresh] forecast", c.id, err)
            }
        }
        return NextResponse.json({
            success: true,
            durationMs: Date.now() - startedAt,
            clients: proClients.length,
            segmentsUpdated,
            forecastsRun,
        })
    } catch (error) {
        console.error("[bi-pro-refresh]", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Error" },
            { status: 500 },
        )
    }
}

export const GET = withSentryCron(
    "bi-pro-refresh",
    { schedule: "0 4 * * *", maxRuntimeSeconds: 300 },
    handler as unknown as (request: NextRequest) => Promise<NextResponse>,
)
