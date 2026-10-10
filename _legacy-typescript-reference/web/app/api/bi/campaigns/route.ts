import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { isBIProEnabled } from "@/lib/constants/plans"

const createSchema = z.object({
    segmentId: z.string().min(1),
    channel: z.enum(["whatsapp", "email"]),
    message: z.string().min(2).max(1000),
    scheduledAt: z.string().datetime().optional(),
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
    const campaigns = await prisma.bICampaign.findMany({
        where: { clientId: g.clientId },
        orderBy: { createdAt: "desc" },
        include: { segment: { select: { id: true, name: true, cachedCount: true } } },
    })
    return NextResponse.json({ campaigns })
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
        // Ownership del segmento
        const segment = await prisma.bISavedSegment.findFirst({
            where: { id: parsed.data.segmentId, clientId: g.clientId },
        })
        if (!segment) return NextResponse.json({ error: "Segmento no encontrado" }, { status: 404 })

        const created = await prisma.bICampaign.create({
            data: {
                clientId: g.clientId,
                segmentId: segment.id,
                channel: parsed.data.channel,
                message: parsed.data.message,
                scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
                recipients: segment.cachedCount,
                status: parsed.data.scheduledAt ? "SCHEDULED" : "DRAFT",
            },
        })
        return NextResponse.json({ campaign: created }, { status: 201 })
    } catch (err) {
        console.error("[bi campaigns POST]", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
