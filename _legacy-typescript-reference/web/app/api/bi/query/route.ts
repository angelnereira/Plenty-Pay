import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import {
    BIQueryError,
    BIQueryService,
    DIMENSION_IDS,
    MEASURE_IDS,
} from "@/features/bi"
import { isBIEnabled } from "@/lib/constants/plans"

const filterSchema = z.object({
    field: z.string().min(1),
    op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "between"]),
    value: z.unknown(),
})

const querySchema = z.object({
    measures: z.array(z.enum(MEASURE_IDS as [string, ...string[]])).min(1),
    dimensions: z.array(z.enum(DIMENSION_IDS as [string, ...string[]])).optional(),
    filters: z.array(filterSchema).optional(),
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

/**
 * POST /api/bi/query
 *
 * Ejecuta un BIQuery contra las vistas materializadas del cliente.
 * Requiere que el cliente tenga `biEnabled` (o `biProEnabled`).
 *
 * Spec: docs/superpowers/specs/2026-05-10-bi-module-design.md (sección 3.3)
 */
export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 })
        }
        const clientId = session.user.clientId
        if (!clientId) {
            return NextResponse.json({ error: "Usuario sin organización" }, { status: 400 })
        }

        // Gating del addon
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { biEnabled: true, biProEnabled: true },
        })
        if (!client || !isBIEnabled(client)) {
            return NextResponse.json(
                { error: "El módulo BI no está activo. Actívalo desde Mi Suscripción." },
                { status: 403 },
            )
        }

        const body = await request.json()
        const parsed = querySchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Body inválido", details: parsed.error.issues },
                { status: 400 },
            )
        }

        const service = new BIQueryService()
        const result = await service.run(parsed.data as never, { clientId })

        return NextResponse.json(result)
    } catch (err) {
        if (err instanceof BIQueryError) {
            return NextResponse.json({ error: err.message, code: err.code }, { status: 400 })
        }
        console.error("[BI query] error", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}
