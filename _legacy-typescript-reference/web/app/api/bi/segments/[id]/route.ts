import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { SegmentService } from "@/features/bi"
import { isBIProEnabled } from "@/lib/constants/plans"

async function gateOwn(id: string) {
    const session = await auth()
    if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
    const clientId = session.user.clientId
    if (!clientId) return { error: NextResponse.json({ error: "Usuario sin organización" }, { status: 400 }) }
    const c = await prisma.client.findUnique({ where: { id: clientId }, select: { biProEnabled: true } })
    if (!c || !isBIProEnabled({ biProEnabled: c.biProEnabled })) {
        return { error: NextResponse.json({ error: "BI Pro no activo" }, { status: 403 }) }
    }
    const seg = await prisma.bISavedSegment.findFirst({ where: { id, clientId } })
    if (!seg) return { error: NextResponse.json({ error: "Segmento no encontrado" }, { status: 404 }) }
    return { clientId, segment: seg }
}

/** GET /api/bi/segments/[id] → expone los miembros (limit 500). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const g = await gateOwn(id)
    if ("error" in g) return g.error
    const def = g.segment.rules as unknown as { entity: "customer"; rules: Array<{ field: "totalSpent"|"totalInvoices"|"ticketAvg"|"lastPurchaseDaysAgo"; op: "lt"|"lte"|"gt"|"gte"|"eq"; value: number }> }
    const service = new SegmentService()
    const members = await service.resolve(g.clientId, def, { limit: 500 })
    return NextResponse.json({ segment: g.segment, members })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const g = await gateOwn(id)
    if ("error" in g) return g.error
    await prisma.bISavedSegment.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
