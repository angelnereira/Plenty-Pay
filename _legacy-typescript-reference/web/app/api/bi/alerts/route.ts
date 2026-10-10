import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { MEASURE_IDS } from "@/features/bi"
import { isBIEnabled } from "@/lib/constants/plans"

const thresholdConfig = z.object({
    metric: z.enum(MEASURE_IDS as [string, ...string[]]),
    op: z.enum(["lt", "lte", "gt", "gte", "eq"]),
    value: z.number().finite(),
    period: z.enum(["today", "7d", "30d"]),
})

const createSchema = z.object({
    name: z.string().min(2).max(80),
    kind: z.enum(["THRESHOLD"]).optional().default("THRESHOLD"),
    config: thresholdConfig,
    isActive: z.boolean().optional().default(true),
})

async function gate() {
    const session = await auth()
    if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
    const clientId = session.user.clientId
    if (!clientId) return { error: NextResponse.json({ error: "Usuario sin organización" }, { status: 400 }) }
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { biEnabled: true, biProEnabled: true },
    })
    if (!client || !isBIEnabled(client)) {
        return { error: NextResponse.json({ error: "BI no activo" }, { status: 403 }) }
    }
    return { clientId }
}

/** GET /api/bi/alerts — lista alertas del cliente. */
export async function GET() {
    const g = await gate()
    if ("error" in g) return g.error
    const alerts = await prisma.bIAlert.findMany({
        where: { clientId: g.clientId },
        orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ alerts })
}

/** POST /api/bi/alerts — crea una alerta. */
export async function POST(request: Request) {
    const g = await gate()
    if ("error" in g) return g.error
    try {
        const body = await request.json()
        const parsed = createSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Body inválido", details: parsed.error.issues },
                { status: 400 },
            )
        }
        const created = await prisma.bIAlert.create({
            data: {
                clientId: g.clientId,
                name: parsed.data.name,
                kind: parsed.data.kind,
                config: parsed.data.config,
                isActive: parsed.data.isActive,
            },
        })
        return NextResponse.json({ alert: created }, { status: 201 })
    } catch (err) {
        console.error("[bi alerts POST] error", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
