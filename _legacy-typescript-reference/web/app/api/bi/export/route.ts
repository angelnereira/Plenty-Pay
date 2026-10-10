import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import {
    BIQueryError,
    BIQueryService,
    DIMENSION_IDS,
    MEASURE_IDS,
    MEASURES,
} from "@/features/bi"
import { exportTo, type ExportColumn } from "@/features/bi/model/services/export.service"
import { isBIEnabled, formatCents } from "@/lib/constants/plans"

const filterSchema = z.object({
    field: z.string().min(1),
    op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "between"]),
    value: z.unknown(),
})

const exportSchema = z.object({
    format: z.enum(["xlsx", "pdf"]),
    title: z.string().min(1).max(120),
    subtitle: z.string().max(200).optional(),
    filename: z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),
    query: z.object({
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
        limit: z.number().int().positive().max(5000).optional(),
    }),
})

/**
 * POST /api/bi/export
 *
 * Ejecuta el BIQuery indicado y devuelve un archivo descargable
 * (xlsx o pdf). Reusa el catálogo de measures para formatear celdas
 * monetarias con `formatCents` y conteos con toLocaleString.
 *
 * Spec: docs/superpowers/specs/2026-05-10-bi-module-design.md (4.1.3)
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
        const parsed = exportSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Body inválido", details: parsed.error.issues },
                { status: 400 },
            )
        }

        // Ejecutar la query
        const service = new BIQueryService()
        const queryResult = await service.run(parsed.data.query as never, { clientId })

        // Construir las columnas formateadas a partir del catálogo de measures
        const columns: ExportColumn[] = []
        for (const dimId of parsed.data.query.dimensions ?? []) {
            columns.push({
                header: dimensionLabel(dimId),
                accessor: dimId,
                align: "left",
            })
        }
        for (const measureId of parsed.data.query.measures) {
            const measure = MEASURES[measureId as keyof typeof MEASURES]
            columns.push({
                header: measure?.label ?? measureId,
                accessor: (row) => formatCell(measureId, row[measureId]),
                align: "right",
            })
        }

        const file = await exportTo(parsed.data.format, {
            title: parsed.data.title,
            subtitle: parsed.data.subtitle,
            columns,
            rows: queryResult.rows as Array<Record<string, unknown>>,
            filename: parsed.data.filename,
        })

        return new NextResponse(new Uint8Array(file.buffer), {
            status: 200,
            headers: {
                "Content-Type": file.contentType,
                "Content-Disposition": `attachment; filename="${file.filename}"`,
                "Cache-Control": "no-store",
            },
        })
    } catch (err) {
        if (err instanceof BIQueryError) {
            return NextResponse.json({ error: err.message, code: err.code }, { status: 400 })
        }
        console.error("[BI export] error", err)
        return NextResponse.json({ error: "Error interno" }, { status: 500 })
    }
}

// ---------- helpers ----------

function dimensionLabel(dimId: string): string {
    switch (dimId) {
        case "day":      return "Día"
        case "week":     return "Semana"
        case "month":    return "Mes"
        case "product":  return "Producto"
        case "customer": return "Cliente"
        default:         return dimId
    }
}

function formatCell(measureId: string, value: unknown): string | number {
    if (value == null) return ""
    const measure = MEASURES[measureId as keyof typeof MEASURES]
    const n = Number(value)
    if (!Number.isFinite(n)) return String(value)
    if (measure?.unit === "currency") return formatCents(n * 100)
    if (measure?.unit === "percentage") return `${(n * 100).toFixed(1)}%`
    return n
}
