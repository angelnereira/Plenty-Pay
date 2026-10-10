import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { isBIProEnabled } from "@/lib/constants/plans"

const layoutSchema = z.object({
    cols: z.number().int().positive().default(12),
    rows: z.array(z.object({
        widgetId: z.string(),
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        w: z.number().int().positive(),
        h: z.number().int().positive(),
    })).default([]),
})

const createSchema = z.object({
    name: z.string().min(2).max(80),
    layout: layoutSchema.optional(),
})

async function gatePro() {
    const session = await auth()
    if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
    const clientId = session.user.clientId
    if (!clientId) return { error: NextResponse.json({ error: "Usuario sin organización" }, { status: 400 }) }
    const userId = session.user.id
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { biEnabled: true, biProEnabled: true },
    })
    if (!client || !isBIProEnabled(client)) {
        return { error: NextResponse.json({ error: "BI Pro no activo" }, { status: 403 }) }
    }
    return { clientId, userId }
}

/** GET /api/bi/dashboards — lista dashboards del cliente. */
export async function GET() {
    const g = await gatePro()
    if ("error" in g) return g.error
    const dashboards = await prisma.bIDashboard.findMany({
        where: { clientId: g.clientId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        include: { _count: { select: { widgets: true } } },
    })
    return NextResponse.json({ dashboards })
}

/** POST /api/bi/dashboards — crea un dashboard custom. */
export async function POST(request: Request) {
    const g = await gatePro()
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
        const created = await prisma.bIDashboard.create({
            data: {
                clientId: g.clientId,
                createdBy: g.userId,
                name: parsed.data.name,
                layout: parsed.data.layout ?? { cols: 12, rows: [] },
            },
        })
        return NextResponse.json({ dashboard: created }, { status: 201 })
    } catch (err) {
        console.error("[bi dashboards POST] error", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
