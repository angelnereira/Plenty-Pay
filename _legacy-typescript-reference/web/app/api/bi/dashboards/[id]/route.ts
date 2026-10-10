import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { isBIProEnabled } from "@/lib/constants/plans"

const layoutSchema = z.object({
    cols: z.number().int().positive(),
    rows: z.array(z.object({
        widgetId: z.string(),
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        w: z.number().int().positive(),
        h: z.number().int().positive(),
    })),
})

const patchSchema = z.object({
    name: z.string().min(2).max(80).optional(),
    layout: layoutSchema.optional(),
    isDefault: z.boolean().optional(),
})

async function gateOwn(id: string) {
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
    const dashboard = await prisma.bIDashboard.findFirst({
        where: { id, clientId },
        include: { widgets: { orderBy: { createdAt: "asc" } } },
    })
    if (!dashboard) return { error: NextResponse.json({ error: "Dashboard no encontrado" }, { status: 404 }) }
    return { clientId, dashboard }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const g = await gateOwn(id)
    if ("error" in g) return g.error
    return NextResponse.json({ dashboard: g.dashboard })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const g = await gateOwn(id)
    if ("error" in g) return g.error
    try {
        const body = await request.json()
        const parsed = patchSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: "Body inválido", details: parsed.error.issues }, { status: 400 })
        }
        // Si marcan este como default, desmarca el resto del cliente
        if (parsed.data.isDefault === true) {
            await prisma.bIDashboard.updateMany({
                where: { clientId: g.clientId, isDefault: true, id: { not: id } },
                data: { isDefault: false },
            })
        }
        const updated = await prisma.bIDashboard.update({
            where: { id },
            data: parsed.data,
        })
        return NextResponse.json({ dashboard: updated })
    } catch (err) {
        console.error("[bi dashboard PATCH]", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const g = await gateOwn(id)
    if ("error" in g) return g.error
    await prisma.bIDashboard.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
