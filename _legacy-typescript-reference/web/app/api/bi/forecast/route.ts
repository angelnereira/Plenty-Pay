import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { ForecastService } from "@/features/bi"
import { isBIProEnabled } from "@/lib/constants/plans"

const schema = z.object({
    metric: z.enum(["sales_total", "invoice_count"]).default("sales_total"),
    horizonDays: z.number().int().min(7).max(90).optional(),
})

async function gatePro() {
    const session = await auth()
    if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
    const clientId = session.user.clientId
    if (!clientId) return { error: NextResponse.json({ error: "Usuario sin organización" }, { status: 400 }) }
    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { biProEnabled: true } })
    if (!c || !isBIProEnabled({ biProEnabled: c.biProEnabled })) {
        return { error: NextResponse.json({ error: "BI Pro no activo" }, { status: 403 }) }
    }
    return { clientId }
}

/** GET /api/bi/forecast?metric=sales_total → último forecast cacheado. */
export async function GET(request: Request) {
    const g = await gatePro()
    if ("error" in g) return g.error
    const url = new URL(request.url)
    const metric = (url.searchParams.get("metric") as "sales_total" | "invoice_count") ?? "sales_total"
    const service = new ForecastService()
    const fc = await service.latest(g.clientId, metric)
    return NextResponse.json({ forecast: fc })
}

/** POST /api/bi/forecast → recomputa y persiste. */
export async function POST(request: Request) {
    const g = await gatePro()
    if ("error" in g) return g.error
    try {
        const body = await request.json().catch(() => ({}))
        const parsed = schema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: "Body inválido", details: parsed.error.issues }, { status: 400 })
        }
        const service = new ForecastService()
        const fc = await service.computeAndSave(g.clientId, parsed.data.metric, {
            horizonDays: parsed.data.horizonDays,
        })
        return NextResponse.json({ forecast: fc })
    } catch (err) {
        console.error("[bi forecast POST]", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
