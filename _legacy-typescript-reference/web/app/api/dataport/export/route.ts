/**
 * POST /api/dataport/export
 *
 * Exportación transversal (SDS/DataPort). Body:
 *   {
 *     scope: 'dataset' | 'module' | 'tenant',
 *     datasets?: string[], modules?: string[],
 *     period?: { from?: 'YYYY-MM-DD', to?: 'YYYY-MM-DD' },
 *     format: 'csv' | 'xlsx' | 'json',
 *     delivery?: 'download' | 'email',
 *     recipients?: string[]
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';
import { resolveAccess, isAccessError } from '@core/dataport/access';
import { resolveExportDatasets } from '@core/dataport/resolve';
import { runExport } from '@core/dataport/export.service';
import { recordExport } from '@core/dataport/evidence';
import { sendEmail } from '@/lib/mail';
import type { ExchangeFormat, ExportScope } from '@core/dataport/contract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SNAPSHOT_MAX_BYTES = 256 * 1024; // snapshot in-DB solo para artefactos pequeños
const EMAIL_ATTACH_MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
    const access = await resolveAccess();
    if (isAccessError(access)) {
        return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.canExport) {
        return NextResponse.json({ error: 'No tienes permiso para exportar datos' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }

    const scope = (body.scope as ExportScope) ?? 'tenant';
    const format = (body.format as ExchangeFormat) ?? 'csv';
    if (!['csv', 'xlsx', 'json'].includes(format)) {
        return NextResponse.json({ error: `Formato no soportado: ${format}` }, { status: 400 });
    }
    const period = (body.period as { from?: string; to?: string }) ?? {};
    const delivery = (body.delivery as string) ?? 'download';

    let datasets;
    let modules;
    try {
        ({ datasets, modules } = resolveExportDatasets(access, {
            scope,
            modules: body.modules as string[] | undefined,
            datasets: body.datasets as string[] | undefined,
        }));
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Selección inválida' }, { status: 400 });
    }

    const datePart = new Date().toISOString().slice(0, 10);
    const filenameBase = scope === 'dataset' && datasets.length === 1
        ? `plentypay-${datasets[0].key}-${datePart}`
        : `plentypay-${scope}-${datePart}`;

    let artifact;
    try {
        artifact = await runExport({ ctx: access.ctx, datasets, period, format, scope, filenameBase });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al exportar';
        // 413 solo si el mensaje viene del límite de filas; el resto son errores internos.
        const isOverLimit = msg.includes('supera el límite');
        return NextResponse.json({ error: msg }, { status: isOverLimit ? 413 : 500 });
    }

    const periodFrom = period.from ? new Date(`${period.from}T00:00:00.000Z`) : null;
    const periodTo = period.to ? new Date(`${period.to}T23:59:59.999Z`) : null;

    // Snapshot in-DB opcional (datasets mutables pequeños) para recuperación real.
    const hasMutable = datasets.some((d) => d.mutability === 'mutable');
    const snapshotGz = hasMutable && artifact.byteSize <= SNAPSHOT_MAX_BYTES
        ? zlib.gzipSync(artifact.buffer)
        : null;

    if (delivery === 'email') {
        if (artifact.byteSize > EMAIL_ATTACH_MAX_BYTES) {
            return NextResponse.json(
                { error: 'El export supera el límite de adjunto por correo (25MB). Acota el período o descárgalo directamente.' },
                { status: 413 },
            );
        }
        // Sin permiso elevado, solo se permite enviar al propio actor (anti-exfiltración).
        const requestedRecipients = (body.recipients as string[] | undefined) ?? [];
        const recipients = access.ctx.elevated && requestedRecipients.length
            ? requestedRecipients
            : [access.ctx.actorEmail];
        await sendEmail({
            to: recipients,
            subject: `Exportación de datos — ${filenameBase}`,
            html: `<p>Adjuntamos tu exportación de datos (<b>${filenameBase}.${artifact.filename.split('.').pop()}</b>).</p>
                   <p>Filas: ${Object.values(artifact.rowCounts).reduce((a, b) => a + b, 0)} · Checksum SHA-256: <code>${artifact.sha256}</code></p>
                   <p style="color:#64748b;font-size:12px">Generado con PlentyPay · DataPort</p>`,
            attachments: [{ filename: artifact.filename, content: artifact.buffer }],
        });

        await recordExport({
            ctx: access.ctx, scope, modules, datasets: datasets.map((d) => d.key),
            periodFrom, periodTo, format: datasets.length > 1 ? 'zip' : format,
            rowCounts: artifact.rowCounts, sha256: artifact.sha256, byteSize: artifact.byteSize,
            deliveryChannel: 'EMAIL', reproducible: artifact.reproducible, snapshotGz,
            params: { scope, period, format, recipients }, message: 'Enviado por correo',
        });

        return NextResponse.json({ success: true, delivered: 'email', sha256: artifact.sha256, rowCounts: artifact.rowCounts });
    }

    // Descarga directa.
    await recordExport({
        ctx: access.ctx, scope, modules, datasets: datasets.map((d) => d.key),
        periodFrom, periodTo,
        format: datasets.length > 1 ? 'zip' : format,
        rowCounts: artifact.rowCounts, sha256: artifact.sha256, byteSize: artifact.byteSize,
        deliveryChannel: 'DOWNLOAD', reproducible: artifact.reproducible, snapshotGz,
        params: { scope, period, format },
    });

    return new NextResponse(artifact.buffer as unknown as BodyInit, {
        status: 200,
        headers: {
            'Content-Type': artifact.contentType,
            'Content-Disposition': `attachment; filename="${artifact.filename}"`,
            'Content-Length': String(artifact.byteSize),
            'X-DataPort-Sha256': artifact.sha256,
            'X-DataPort-Reproducible': String(artifact.reproducible),
            'Cache-Control': 'no-store',
        },
    });
}
