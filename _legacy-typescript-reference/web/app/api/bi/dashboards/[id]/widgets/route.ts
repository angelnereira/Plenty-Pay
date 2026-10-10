import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { DIMENSION_IDS, MEASURE_IDS } from "@/features/bi"
import { isBIProEnabled } from "@/lib/constants/plans"

const querySchema = z.object({
    measures: z.array(z.enum(MEASURE_IDS as [string, ...string[]])).min(1),
    dimensions: z.array(z.enum(DIMENSION_IDS as [string, ...string[]])).optional(),
    dateRange: z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).optional(),
    sortBy: z.object({
        field: z.string().min(1),
        direction: z.enum(["asc", "desc"]),
    }).optional(),
    limit: z.number().int().positive().max(1000).optional(),
})

const createSchema = z.object({
    type: z.enum(["kpi", "line", "bar", "pie", "table"]),
    title: z.string().min(1).max(80),
    query: querySchema,
    options: z.record(z.string(), z.unknown()).optional(),
})

async function gateOwn(dashboardId: string) {
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
        where: { id: dashboardId, clientId },
        select: { id: true },
    })
    if (!dashboard) return { error: NextResponse.json({ error: "Dashboard no encontrado" }, { status: 404 }) }
    return { clientId, dashboardId }
}

/** POST /api/bi/dashboards/[id]/widgets — agrega un widget. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const g = await gateOwn(id)
    if ("error" in g) return g.error
    try {
        const body = await request.json()
        const parsed = createSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json({ error: "Body inválido", details: parsed.error.issues }, { status: 400 })
        }
        const created = await prisma.bIWidget.create({
            data: {
                dashboardId: g.dashboardId,
                type: parsed.data.type,
                title: parsed.data.title,
                query: parsed.data.query,
                options: parsed.data.options ?? undefined,
            },
        })
        return NextResponse.json({ widget: created }, { status: 201 })
    } catch (err) {
        console.error("[widget POST]", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
