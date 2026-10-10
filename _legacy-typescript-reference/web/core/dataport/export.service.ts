/**
 * core/dataport/export.service.ts
 *
 * Orquestador de exportación. Lee por streaming (memoria acotada en lectura),
 * serializa al formato pedido, empaqueta en ZIP si hay múltiples datasets
 * (con manifest.json), y calcula el checksum SHA-256 del artefacto.
 *
 * v1 (decisión "sin persistencia"): el artefacto se materializa en un Buffer
 * acotado por presupuesto y se entrega por descarga/correo; no se guarda.
 */

import crypto from 'crypto';
import type {
    TenantCtx,
    ExchangeFormat,
    ExportArtifact,
    DatasetDescriptor,
    PeriodOpts,
} from './contract';
import { streamDataset } from './engine';
import { topoSort } from './registry';
import { toCsv } from './serializers/csv';
import { toJson } from './serializers/json';
import { toXlsx } from './serializers/xlsx';
import { toZip, type ZipEntry } from './serializers/bundle';

/** Guarda de presupuesto por dataset (sin persistencia: todo va a memoria/adjunto). */
export const MAX_ROWS_PER_DATASET = 100_000;

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;

export interface ExportRequestInput {
    ctx: TenantCtx;
    datasets: DatasetDescriptor[]; // ya autorizados por el caller
    period: PeriodOpts;
    format: ExchangeFormat;
    scope: string;
    filenameBase: string;
}

const CONTENT_TYPE: Record<string, string> = {
    csv: 'text/csv; charset=utf-8',
    json: 'application/json; charset=utf-8',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    zip: 'application/zip',
};

function sha256(buf: Buffer): string {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

async function collectRows(d: DatasetDescriptor, ctx: TenantCtx, period: PeriodOpts): Promise<Row[]> {
    const rows: Row[] = [];
    for await (const r of streamDataset(d, ctx, period)) {
        rows.push(r);
        if (rows.length > MAX_ROWS_PER_DATASET) {
            throw new Error(
                `El dataset '${d.key}' supera el límite de ${MAX_ROWS_PER_DATASET.toLocaleString('es-PA')} filas para export directo. Acota el período o usa una exportación programada.`,
            );
        }
    }
    return rows;
}

async function serializeOne(format: ExchangeFormat, d: DatasetDescriptor, rows: Row[]): Promise<Buffer> {
    if (format === 'csv') return toCsv(rows);
    if (format === 'json') return toJson(d.key, d.version, rows);
    return toXlsx(d.label, rows);
}

/** Un período se considera "cerrado" si su fin es estrictamente anterior a hoy (UTC). */
function isClosedPeriod(period: PeriodOpts): boolean {
    if (!period.to) return false;
    const end = new Date(`${period.to}T23:59:59.999Z`);
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    return end < startOfTodayUtc;
}

export async function runExport(input: ExportRequestInput): Promise<ExportArtifact> {
    const { ctx, period, format, filenameBase } = input;
    const ordered = topoSort(input.datasets);
    const rowCounts: Record<string, number> = {};

    // Reproducibilidad garantizada solo si TODOS los datasets son inmutables y el período está cerrado.
    const reproducible = ordered.length > 0
        && ordered.every((d) => d.mutability === 'immutable')
        && isClosedPeriod(period);

    if (ordered.length === 1) {
        const d = ordered[0];
        const rows = await collectRows(d, ctx, period);
        rowCounts[d.key] = rows.length;
        const buffer = await serializeOne(format, d, rows);
        return {
            buffer,
            filename: `${filenameBase}.${format}`,
            contentType: CONTENT_TYPE[format],
            sha256: sha256(buffer),
            byteSize: buffer.length,
            rowCounts,
            reproducible,
        };
    }

    // Múltiples datasets → ZIP con un archivo por dataset + manifest.json
    const entries: ZipEntry[] = [];
    const manifestDatasets: Array<Record<string, unknown>> = [];
    for (const d of ordered) {
        const rows = await collectRows(d, ctx, period);
        rowCounts[d.key] = rows.length;
        const buf = await serializeOne(format, d, rows);
        const name = `${d.module}/${d.key}.${format}`;
        entries.push({ name, buffer: buf });
        manifestDatasets.push({
            key: d.key,
            module: d.module,
            version: d.version,
            file: name,
            count: rows.length,
            sha256: sha256(buf),
            mutability: d.mutability,
            sensitivity: d.sensitivity,
            dependsOn: d.dependsOn ?? [],
        });
    }
    const manifest = {
        standard: 'SDS-1',
        tenant: ctx.clientId,
        generatedAt: new Date().toISOString(),
        format,
        period,
        datasets: manifestDatasets,
    };
    entries.push({ name: 'manifest.json', buffer: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') });

    const buffer = await toZip(entries);
    return {
        buffer,
        filename: `${filenameBase}.zip`,
        contentType: CONTENT_TYPE.zip,
        sha256: sha256(buffer),
        byteSize: buffer.length,
        rowCounts,
        reproducible,
    };
}
