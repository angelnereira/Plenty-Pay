import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@core/database';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import { Prisma } from '@prisma/client';

/**
 * GET /api/catalogs/locations
 *
 * Búsqueda de ubicaciones de Panamá.
 * Respuestas cacheadas en Redis por 24h por combinación de parámetros.
 *
 * Query params:
 * - q: búsqueda general (código, provincia, distrito, corregimiento)
 * - provincia: filtrar por provincia
 * - code: filtrar por código exacto
 * - limit: límite de resultados (default: 20, max: 100)
 */

const querySchema = z.object({
    q: z.string().optional(),
    provincia: z.string().optional(),
    code: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
});

const CACHE_TTL = 60 * 60 * 24; // 24 horas

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Validar query params
        const params = querySchema.parse({
            q: searchParams.get('q'),
            provincia: searchParams.get('provincia'),
            code: searchParams.get('code'),
            limit: searchParams.get('limit') || '20',
        });

        // ── Cache key determinista basada en los parámetros ─────────────────
        const cacheKey = `cache:locations:${JSON.stringify(params)}`;

        // ── Intentar leer desde Redis ────────────────────────────────────────
        try {
            const cached = await redis.get<{ data: unknown[]; meta: object }>(cacheKey);
            if (cached) {
                return NextResponse.json(
                    { success: true, ...cached, fromCache: true },
                    { headers: { 'X-Cache': 'HIT' } }
                );
            }
        } catch (cacheReadErr) {
            // Si Redis falla en lectura, continuamos hacia la DB
            console.error('[locations] Cache read error, falling back to DB:', cacheReadErr);
        }

        // ── Construir where clause ───────────────────────────────────────────
        const where: Prisma.HKALocationWhereInput = {};

        if (params.code) {
            where.code = params.code;
        } else {
            const conditions: Prisma.HKALocationWhereInput[] = [];

            if (params.q) {
                conditions.push({
                    OR: [
                        { code: { contains: params.q, mode: 'insensitive' } },
                        { provincia: { contains: params.q, mode: 'insensitive' } },
                        { distrito: { contains: params.q, mode: 'insensitive' } },
                        { corregimiento: { contains: params.q, mode: 'insensitive' } },
                        { fullName: { contains: params.q, mode: 'insensitive' } },
                    ],
                });
            }

            if (params.provincia) {
                conditions.push({
                    provincia: { equals: params.provincia, mode: 'insensitive' },
                });
            }

            if (conditions.length > 0) {
                where.AND = conditions;
            }
        }

        // ── Ejecutar query en DB ─────────────────────────────────────────────
        const [locations, total] = await Promise.all([
            prisma.hKALocation.findMany({
                where,
                take: params.limit,
                orderBy: [
                    { provincia: 'asc' },
                    { distrito: 'asc' },
                    { corregimiento: 'asc' },
                ],
                select: {
                    id: true,
                    code: true,
                    provincia: true,
                    distrito: true,
                    corregimiento: true,
                    fullName: true,
                },
            }),
            prisma.hKALocation.count({ where }),
        ]);

        const responsePayload = {
            data: locations,
            meta: {
                total,
                limit: params.limit,
                hasMore: total > params.limit,
            },
        };

        // ── Guardar en Redis (sin bloquear la respuesta) ─────────────────────
        redis.setex(cacheKey, CACHE_TTL, responsePayload).catch((cacheWriteErr) => {
            console.error('[locations] Cache write error:', cacheWriteErr);
        });

        return NextResponse.json(
            { success: true, ...responsePayload, fromCache: false },
            { headers: { 'X-Cache': 'MISS' } }
        );

    } catch (error) {
        console.error('[API] Error fetching locations:', error);

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
                error: 'Failed to fetch locations',
            },
            { status: 500 }
        );
    }
}

