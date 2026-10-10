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

const patchSchema = z.object({
    name: z.string().min(2).max(80).optional(),
    config: thresholdConfig.optional(),
    isActive: z.boolean().optional(),
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

async function ensureOwnership(id: string, clientId: string) {
    const a = await prisma.bIAlert.findFirst({ where: { id, clientId }, select: { id: true } })
    return a !== null
}

/** PATCH /api/bi/alerts/[id] — edita una alerta. */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const g = await gate()
    if ("error" in g) return g.error
    const { id } = await params
    if (!(await ensureOwnership(id, g.clientId))) {
        return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 })
    }
    try {
        const body = await request.json()
        const parsed = patchSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Body inválido", details: parsed.error.issues },
                { status: 400 },
            )
        }
        const updated = await prisma.bIAlert.update({
            where: { id },
            data: parsed.data,
        })
        return NextResponse.json({ alert: updated })
    } catch (err) {
        console.error("[bi alerts PATCH] error", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}

/** DELETE /api/bi/alerts/[id] — borra una alerta. */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const g = await gate()
    if ("error" in g) return g.error
    const { id } = await params
    if (!(await ensureOwnership(id, g.clientId))) {
        return NextResponse.json({ error: "Alerta no encontrada" }, { status: 404 })
    }
    await prisma.bIAlert.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
