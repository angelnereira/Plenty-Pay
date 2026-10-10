import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { SegmentService } from "@/features/bi"
import { isBIProEnabled } from "@/lib/constants/plans"

const ruleSchema = z.object({
    field: z.enum(["totalSpent", "totalInvoices", "ticketAvg", "lastPurchaseDaysAgo"]),
    op: z.enum(["lt", "lte", "gt", "gte", "eq"]),
    value: z.number().finite(),
})

const createSchema = z.object({
    name: z.string().min(2).max(80),
    rules: z.array(ruleSchema).min(1).max(10),
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

export async function GET() {
    const g = await gatePro()
    if ("error" in g) return g.error
    const segments = await prisma.bISavedSegment.findMany({
        where: { clientId: g.clientId },
        orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ segments })
}

export async function POST(request: Request) {
    const g = await gatePro()
    if ("error" in g) return g.error
    try {
        const body = await request.json()
        const parsed = createSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: "Body inválido", details: parsed.error.issues }, { status: 400 })
        }
        const service = new SegmentService()
        const def = { entity: "customer" as const, rules: parsed.data.rules }
        const members = await service.resolve(g.clientId, def, { limit: 2000 })
        const created = await prisma.bISavedSegment.create({
            data: {
                clientId: g.clientId,
                name: parsed.data.name,
                entity: "customer",
                rules: def,
                cachedCount: members.length,
                refreshedAt: new Date(),
            },
        })
        return NextResponse.json({ segment: created, count: members.length }, { status: 201 })
    } catch (err) {
        console.error("[bi segments POST]", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
