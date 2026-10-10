/**
 * GET /api/dataport/catalog
 *
 * Catálogo de capacidades del tenant (módulos/datasets exportables/importables)
 * + historial reciente de evidencia. Alimenta la UI de /dashboard/datos.
 */

import { NextResponse } from 'next/server';
import { prismaServer as prisma } from '@core/database';
import { resolveAccess, isAccessError } from '@core/dataport/access';
import { capabilities } from '@core/dataport/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const access = await resolveAccess();
    if (isAccessError(access)) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const [history, schedules] = await Promise.all([
        prisma.dataExchangeRecord.findMany({
            where: { clientId: access.ctx.clientId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true, direction: true, scope: true, modules: true, datasets: true,
                format: true, rowCounts: true, artifactSha256: true, byteSize: true,
                deliveryChannel: true, deliveryStatus: true, reproducible: true,
                actorEmail: true, createdAt: true, message: true,
            },
        }),
        prisma.scheduledExport.findMany({
            where: { clientId: access.ctx.clientId },
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    return NextResponse.json({
        capabilities: capabilities(access.clientFlags),
        permissions: { canExport: access.canExport, canImport: access.canImport, elevated: access.ctx.elevated },
        history,
        schedules,
    });
}
