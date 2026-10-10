/**
 * GET/POST/DELETE /api/dataport/schedules
 *
 * Gestión de exportaciones programadas (entrega por correo vía cron dispatcher).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prismaServer as prisma } from '@core/database';
import { resolveAccess, isAccessError } from '@core/dataport/access';
import { computeNextRun, type Frequency } from '@core/dataport/schedule';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const access = await resolveAccess();
    if (isAccessError(access)) return NextResponse.json({ error: access.error }, { status: access.status });
    const schedules = await prisma.scheduledExport.findMany({
        where: { clientId: access.ctx.clientId },
        orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ schedules });
}

export async function POST(req: NextRequest) {
    const access = await resolveAccess();
    if (isAccessError(access)) return NextResponse.json({ error: access.error }, { status: access.status });
    if (!access.canExport) return NextResponse.json({ error: 'Sin permiso para exportar' }, { status: 403 });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

    const frequency = (body.frequency as Frequency) ?? 'WEEKLY';
    const atHour = Math.min(23, Math.max(0, Number(body.atHour ?? 6)));
    const recipients = (body.recipients as string[] | undefined)?.length
        ? (body.recipients as string[])
        : [access.ctx.actorEmail];

    const nextRunAt = computeNextRun(frequency, atHour, {
        dayOfWeek: body.dayOfWeek as number | undefined,
        dayOfMonth: body.dayOfMonth as number | undefined,
    });

    const created = await prisma.scheduledExport.create({
        data: {
            clientId: access.ctx.clientId,
            name: String(body.name ?? 'Exportación programada'),
            active: body.active !== false,
            frequency,
            atHour,
            dayOfWeek: (body.dayOfWeek as number | undefined) ?? null,
            dayOfMonth: (body.dayOfMonth as number | undefined) ?? null,
            scope: String(body.scope ?? 'tenant'),
            modules: (body.modules as string[] | undefined) ?? [],
            datasets: (body.datasets as string[] | undefined) ?? [],
            format: (body.format as 'csv' | 'xlsx' | 'json') ?? 'csv',
            recipients,
            periodWindow: String(body.periodWindow ?? 'ROLLING_30D'),
            nextRunAt,
            createdById: access.ctx.actorUserId,
        },
    });

    return NextResponse.json({ success: true, schedule: created });
}

export async function DELETE(req: NextRequest) {
    const access = await resolveAccess();
    if (isAccessError(access)) return NextResponse.json({ error: access.error }, { status: access.status });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    // Scoping: solo borra si pertenece al tenant.
    await prisma.scheduledExport.deleteMany({ where: { id, clientId: access.ctx.clientId } });
    return NextResponse.json({ success: true });
}
