/**
 * GET /api/cron/dataport-dispatch
 *
 * Dispatcher de exportaciones programadas (SDS/DataPort). Escanea
 * ScheduledExport vencidos, genera el artefacto y lo entrega por correo,
 * registrando evidencia. Asegurado con CRON_SECRET + lock Redis (anti-solape).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prismaServer as prisma } from '@core/database';
import { redis } from '@/lib/redis';
import { sendEmail } from '@/lib/mail';
import { resolveExportDatasets } from '@core/dataport/resolve';
import { runExport } from '@core/dataport/export.service';
import { recordExport } from '@core/dataport/evidence';
import { computeNextRun, resolveWindow, type Frequency } from '@core/dataport/schedule';
import type { ResolvedAccess } from '@core/dataport/access';
import type { ExchangeFormat, ExportScope } from '@core/dataport/contract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOCK_KEY = 'dataport:dispatch:lock';

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    // Fail-closed: si CRON_SECRET no está configurado, bloquear siempre.
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Lock distribuido (best-effort): evita corridas paralelas.
    const lock = await redis.set(LOCK_KEY, '1', { nx: true, ex: 300 });
    if (lock !== 'OK') {
        return NextResponse.json({ skipped: 'lock-held' });
    }

    const now = new Date();
    const due = await prisma.scheduledExport.findMany({
        where: { active: true, nextRunAt: { lte: now } },
        take: 25,
    });

    const results: Array<{ id: string; status: string; detail?: string }> = [];

    for (const s of due) {
        try {
            const client = await prisma.client.findUnique({ where: { id: s.clientId } });
            if (!client) {
                results.push({ id: s.id, status: 'skip', detail: 'tenant inexistente' });
                continue;
            }

            const access: ResolvedAccess = {
                ctx: {
                    clientId: s.clientId,
                    actorUserId: s.createdById ?? 'scheduler',
                    actorEmail: 'scheduler@plentypay.com',
                    elevated: true, // corrida del sistema autorizada por el dueño al crear el schedule
                },
                clientFlags: client as unknown as Record<string, unknown>,
                canExport: true,
                canImport: false,
            };

            const { datasets, modules } = resolveExportDatasets(access, {
                scope: s.scope as ExportScope,
                modules: s.modules,
                datasets: s.datasets,
            });

            const period = resolveWindow(s.periodWindow, now);
            const datePart = now.toISOString().slice(0, 10);
            const artifact = await runExport({
                ctx: access.ctx,
                datasets,
                period,
                format: s.format as ExchangeFormat,
                scope: s.scope,
                filenameBase: `plentypay-${s.scope}-${datePart}`,
            });

            await sendEmail({
                to: s.recipients,
                subject: `Exportación programada: ${s.name}`,
                html: `<p>Tu exportación programada <b>${s.name}</b> está lista.</p>
                       <p>Filas: ${Object.values(artifact.rowCounts).reduce((a, b) => a + b, 0)} · SHA-256: <code>${artifact.sha256}</code></p>
                       <p style="color:#64748b;font-size:12px">Generado con PlentyPay · DataPort</p>`,
                attachments: [{ filename: artifact.filename, content: artifact.buffer }],
            });

            await recordExport({
                ctx: access.ctx,
                scope: s.scope,
                modules,
                datasets: datasets.map((d) => d.key),
                periodFrom: period.from ? new Date(`${period.from}T00:00:00.000Z`) : null,
                periodTo: period.to ? new Date(`${period.to}T23:59:59.999Z`) : null,
                format: datasets.length > 1 ? 'zip' : (s.format as ExchangeFormat),
                rowCounts: artifact.rowCounts,
                sha256: artifact.sha256,
                byteSize: artifact.byteSize,
                deliveryChannel: 'SCHEDULED',
                reproducible: artifact.reproducible,
                scheduledExportId: s.id,
                params: { scope: s.scope, periodWindow: s.periodWindow, format: s.format },
                message: `Programada → ${s.recipients.join(', ')}`,
            });

            const nextRunAt = computeNextRun(s.frequency as Frequency, s.atHour, {
                dayOfWeek: s.dayOfWeek,
                dayOfMonth: s.dayOfMonth,
            }, new Date(now.getTime() + 60_000));
            await prisma.scheduledExport.update({
                where: { id: s.id },
                data: { lastRunAt: now, nextRunAt },
            });

            results.push({ id: s.id, status: 'ok' });
        } catch (e) {
            results.push({ id: s.id, status: 'error', detail: e instanceof Error ? e.message : 'error' });
        }
    }

    await redis.del(LOCK_KEY);
    return NextResponse.json({ processed: results.length, results });
}
