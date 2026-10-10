import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@core/database';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import { Prisma } from '@prisma/client';

/**
 * GET /api/catalogs/cpbs
 * 
 * Búsqueda de categorías CPBS (Codificación Panameña de Bienes y Servicios)
 * 
 * Query params:
 * - q: búsqueda general (segmento, familia, nombres)
 * - segment: filtrar por segmento (2 dígitos)
 * - family: filtrar por familia (4 dígitos)
 * - limit: límite de resultados (default: 20, max: 100)
 */

const querySchema = z.object({
    q: z.string().optional(),
    segment: z.string().length(2).optional(),
    family: z.string().length(4).optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Validar query params
        const params = querySchema.parse({
            q: searchParams.get('q'),
            segment: searchParams.get('segment'),
            family: searchParams.get('family'),
            limit: searchParams.get('limit') || '20',
        });

        // ── CACHE LAYER: Redis (L2) ──────────────────────────────────────────
        const cacheKey = `catalog:cpbs:${JSON.stringify(params)}`;
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                return NextResponse.json(cached);
            }
        } catch (e) {
            console.warn('[Redis] Cache read error:', e);
        }
        // ───────────────────────────────────────────────────────────────────

        // Construir where clause
        const where: Prisma.HKACPBSCategoryWhereInput = {};
        const conditions: Prisma.HKACPBSCategoryWhereInput[] = [];

        if (params.family) {
            // Búsqueda exacta por familia
            where.family = params.family;
        } else if (params.segment) {
            // Filtrar por segmento
            where.segment = params.segment;
        }

        if (params.q) {
            conditions.push({
                OR: [
                    { segment: { contains: params.q, mode: 'insensitive' } },
                    { family: { contains: params.q, mode: 'insensitive' } },
                    { segmentName: { contains: params.q, mode: 'insensitive' } },
                    { familyName: { contains: params.q, mode: 'insensitive' } },
                ],
            });
        }

        if (conditions.length > 0) {
            where.AND = conditions;
        }

        // Ejecutar query
        const categories = await prisma.hKACPBSCategory.findMany({
            where,
            take: params.limit,
            orderBy: [
                { segment: 'asc' },
                { family: 'asc' },
            ],
            select: {
                id: true,
                segment: true,
                family: true,
                segmentName: true,
                familyName: true,
            },
        });

        // Obtener total count
        const total = await prisma.hKACPBSCategory.count({ where });

        // Agrupar por segmento para mejor UX
        const grouped = categories.reduce((acc, cat) => {
            if (!acc[cat.segment]) {
                acc[cat.segment] = {
                    segment: cat.segment,
                    segmentName: cat.segmentName,
                    families: [],
                };
            }
            acc[cat.segment].families.push({
                family: cat.family,
                familyName: cat.familyName,
            });
            return acc;
        }, {} as Record<string, any>);

        const response = {
            success: true,
            data: {
                categories,
                grouped: Object.values(grouped),
            },
            meta: {
                total,
                limit: params.limit,
                hasMore: total > params.limit,
            },
        };

        // ── CACHE LAYER: Write ──────────────────────────────────────────────
        try {
            await redis.set(cacheKey, response, { ex: 86400 }); // 24h
        } catch (e) {
            console.warn('[Redis] Cache write error:', e);
        }
        // ───────────────────────────────────────────────────────────────────

        return NextResponse.json(response);

    } catch (error) {
        console.error('[API] Error fetching CPBS categories:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid query parameters',
                    details: error.issues,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch CPBS categories',
            },
            { status: 500 }
        );
    }
}
