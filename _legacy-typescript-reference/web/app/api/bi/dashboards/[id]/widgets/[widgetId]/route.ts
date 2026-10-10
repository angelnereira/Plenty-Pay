import { NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { isBIProEnabled } from "@/lib/constants/plans"

async function gateOwn(dashboardId: string, widgetId: string) {
    const session = await auth()
    if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
    const clientId = session.user.clientId
    if (!clientId) return { error: NextResponse.json({ error: "Usuario sin organización" }, { status: 400 }) }
    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { biProEnabled: true },
    })
    if (!client || !isBIProEnabled({ biProEnabled: client.biProEnabled })) {
        return { error: NextResponse.json({ error: "BI Pro no activo" }, { status: 403 }) }
    }
    const w = await prisma.bIWidget.findFirst({
        where: { id: widgetId, dashboard: { id: dashboardId, clientId } },
        select: { id: true },
    })
    if (!w) return { error: NextResponse.json({ error: "Widget no encontrado" }, { status: 404 }) }
    return { widgetId }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; widgetId: string }> }) {
    const { id, widgetId } = await params
    const g = await gateOwn(id, widgetId)
    if ("error" in g) return g.error
    await prisma.bIWidget.delete({ where: { id: g.widgetId } })
    return NextResponse.json({ success: true })
}
