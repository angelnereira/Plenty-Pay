import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
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
    const camp = await prisma.bICampaign.findFirst({ where: { id, clientId } })
    if (!camp) return { error: NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 }) }
    return { clientId, campaign: camp }
}

/**
 * PATCH /api/bi/campaigns/[id]
 * Acciones soportadas:
 *   - { action: "send" }   → marca SENT, sentAt = NOW (envío real es Fase 4 — vía whatsapp/email service)
 *   - { action: "cancel" } → vuelve a DRAFT
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const g = await gateOwn(id)
    if ("error" in g) return g.error
    try {
        const body = await request.json()
        if (body.action === "send") {
            const updated = await prisma.bICampaign.update({
                where: { id },
                data: { status: "SENT", sentAt: new Date() },
            })
            return NextResponse.json({ campaign: updated })
        }
        if (body.action === "cancel") {
            const updated = await prisma.bICampaign.update({
                where: { id },
                data: { status: "DRAFT", scheduledAt: null },
            })
            return NextResponse.json({ campaign: updated })
        }
        return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
    } catch (err) {
        console.error("[bi campaign PATCH]", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const g = await gateOwn(id)
    if ("error" in g) return g.error
    await prisma.bICampaign.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
