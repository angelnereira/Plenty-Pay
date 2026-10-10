import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@core/database';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import { Prisma } from '@prisma/client';

/**
 * GET /api/catalogs/countries
 * 
 * Listado y búsqueda de países
 * 
 * Query params:
 * - q: búsqueda general (código, nombre)
 * - code: filtrar por código exacto (PA, US, etc.)
 * - limit: límite de resultados (default: 50, max: 100)
 */

const querySchema = z.object({
    q: z.string().optional(),
    code: z.string().length(2).optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Validar query params
        const params = querySchema.parse({
            q: searchParams.get('q'),
            code: searchParams.get('code'),
            limit: searchParams.get('limit') || '50',
        });

        // ── CACHE LAYER: Redis (L2) ──────────────────────────────────────────
        const cacheKey = `catalog:countries:${JSON.stringify(params)}`;
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
        const where: Prisma.HKACountryWhereInput = {};

        if (params.code) {
            // Búsqueda exacta por código
            where.code = params.code.toUpperCase();
        } else if (params.q) {
            // Búsqueda general
            where.OR = [
                { code: { contains: params.q, mode: 'insensitive' } },
                { name: { contains: params.q, mode: 'insensitive' } },
                { nameEs: { contains: params.q, mode: 'insensitive' } },
            ];
        }

        // Ejecutar query
        const countries = await prisma.hKACountry.findMany({
            where,
            take: params.limit,
            orderBy: {
                nameEs: 'asc',
            },
            select: {
                id: true,
                code: true,
                name: true,
                nameEs: true,
            },
        });

        // Obtener total count
        const total = await prisma.hKACountry.count({ where });

        const response = {
            success: true,
            data: countries,
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
        console.error('[API] Error fetching countries:', error);

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
                error: 'Failed to fetch countries',
            },
            { status: 500 }
        );
    }
}
