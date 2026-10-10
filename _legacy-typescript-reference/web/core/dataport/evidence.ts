/**
 * core/dataport/evidence.ts
 *
 * Escritura de evidencia inmutable (DataExchangeRecord). A nivel de aplicación
 * SOLO se inserta — nunca se actualiza ni borra — para preservar la bitácora.
 */

import { prismaServer as prisma } from '@core/database';
import type { TenantCtx, ExchangeFormat } from './contract';

type Channel = 'DOWNLOAD' | 'EMAIL' | 'SCHEDULED';

export interface ExportEvidence {
    ctx: TenantCtx;
    scope: string;
    modules: string[];
    datasets: string[];
    periodFrom?: Date | null;
    periodTo?: Date | null;
    format: ExchangeFormat | 'zip';
    rowCounts: Record<string, number>;
    sha256: string;
    byteSize: number;
    deliveryChannel: Channel;
    reproducible: boolean;
    scheduledExportId?: string | null;
    snapshotGz?: Buffer | null;
    deliveryStatus?: string;
    message?: string;
    params?: Record<string, unknown>;
}

export async function recordExport(e: ExportEvidence): Promise<string> {
    const rec = await prisma.dataExchangeRecord.create({
        data: {
            clientId: e.ctx.clientId,
            actorUserId: e.ctx.actorUserId,
            actorEmail: e.ctx.actorEmail,
            direction: 'EXPORT',
            scope: e.scope,
            modules: e.modules,
            datasets: e.datasets,
            periodFrom: e.periodFrom ?? null,
            periodTo: e.periodTo ?? null,
            format: e.format,
            rowCounts: e.rowCounts,
            artifactSha256: e.sha256,
            byteSize: e.byteSize,
            deliveryChannel: e.deliveryChannel,
            deliveryStatus: e.deliveryStatus ?? 'OK',
            reproducible: e.reproducible,
            scheduledExportId: e.scheduledExportId ?? null,
            snapshotGz: e.snapshotGz ? new Uint8Array(e.snapshotGz) : null,
            params: (e.params ?? {}) as object,
            message: e.message,
        },
        select: { id: true },
    });
    return rec.id;
}

export interface ImportEvidence {
    ctx: TenantCtx;
    dataset: string;
    module: string;
    format: ExchangeFormat;
    sha256: string;
    byteSize: number;
    importBatchId: string;
    rowCounts: Record<string, number>;
    deliveryStatus?: string;
    message?: string;
}

export async function recordImport(e: ImportEvidence): Promise<string> {
    const rec = await prisma.dataExchangeRecord.create({
        data: {
            clientId: e.ctx.clientId,
            actorUserId: e.ctx.actorUserId,
            actorEmail: e.ctx.actorEmail,
            direction: 'IMPORT',
            scope: 'dataset',
            modules: [e.module],
            datasets: [e.dataset],
            format: e.format,
            rowCounts: e.rowCounts,
            artifactSha256: e.sha256,
            byteSize: e.byteSize,
            deliveryChannel: 'DOWNLOAD',
            deliveryStatus: e.deliveryStatus ?? 'OK',
            reproducible: false,
            importBatchId: e.importBatchId,
            params: {},
            message: e.message,
        },
        select: { id: true },
    });
    return rec.id;
}
