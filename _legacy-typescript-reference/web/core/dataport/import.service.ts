/**
 * core/dataport/import.service.ts
 *
 * Orquestador de importación controlada: parseo (CSV/JSON), validación
 * (dry-run con preview), y commit idempotente por lotes (upsert por clave
 * natural). Reutiliza papaparse. Solo datos maestros (datasets con importSpec).
 */

import crypto from 'crypto';
import Papa from 'papaparse';
import { prismaServer as prisma } from '@core/database';
import type {
    TenantCtx,
    DatasetDescriptor,
    ImportMode,
    ImportPreview,
    ImportResult,
    RowError,
} from './contract';

type Raw = Record<string, unknown>;

export interface ImportInput {
    ctx: TenantCtx;
    dataset: DatasetDescriptor;
    format: 'csv' | 'json';
    content: string;          // contenido textual del archivo
    mode: ImportMode;
}

function parseRows(format: 'csv' | 'json', content: string): Raw[] {
    if (format === 'csv') {
        const res = Papa.parse<Raw>(content, { header: true, skipEmptyLines: true });
        return (res.data ?? []).filter((r) => r && typeof r === 'object');
    }
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed as Raw[];
    if (parsed && Array.isArray(parsed.rows)) return parsed.rows as Raw[];
    throw new Error('JSON inválido: se esperaba un arreglo o un objeto con "rows".');
}

function coerceBoolean(v: unknown): boolean | undefined {
    if (v === null || v === undefined || v === '') return undefined;
    const s = String(v).trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes', 'y'].includes(s)) return true;
    if (['false', '0', 'no', 'n'].includes(s)) return false;
    return undefined;
}

function compositeKey(row: Raw, naturalKey: string[]): string {
    return naturalKey.map((f) => String(row[f] ?? '')).join('');
}

/** Valida y normaliza filas según el importSpec. No escribe nada. */
function validate(d: DatasetDescriptor, rows: Raw[]): { normalized: Raw[]; errors: RowError[] } {
    const spec = d.importSpec!;
    const allowed = new Set(spec.allowedFields);
    const numeric = new Set(spec.numericFields ?? []);
    const boolean = new Set(spec.booleanFields ?? []);
    const required = new Set([...spec.requiredFields, ...spec.naturalKey]);
    const normalized: Raw[] = [];
    const errors: RowError[] = [];

    rows.forEach((raw, i) => {
        const rowNum = i + 1;
        const out: Raw = {};
        for (const [k, v] of Object.entries(raw)) {
            if (!allowed.has(k)) continue;
            if (boolean.has(k)) {
                const b = coerceBoolean(v);
                if (b !== undefined) out[k] = b;
            } else if (numeric.has(k)) {
                if (v === null || v === undefined || v === '') continue;
                const n = Number(v);
                if (Number.isNaN(n)) {
                    errors.push({ row: rowNum, field: k, message: `Valor no numérico: "${String(v)}"` });
                } else {
                    out[k] = n;
                }
            } else {
                if (v !== null && v !== undefined && String(v).trim() !== '') out[k] = String(v).trim();
            }
        }
        let rowOk = true;
        for (const req of required) {
            if (out[req] === undefined) {
                errors.push({ row: rowNum, field: req, message: `Campo obligatorio faltante` });
                rowOk = false;
            }
        }
        if (rowOk) normalized.push(out);
    });

    return { normalized, errors };
}

/** Calcula cuántas filas son nuevas vs existentes (por clave natural). */
async function partitionExisting(
    d: DatasetDescriptor,
    ctx: TenantCtx,
    rows: Raw[],
): Promise<{ existing: Set<string> }> {
    const spec = d.importSpec!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[d.model!];
    // OR exacto por cada clave compuesta — evita producto cruzado de `AND {field: {in: []}}`:
    // ['12','3'] no coincidiría falsamente con ['1','23'] si se usan IN separados.
    const OR = rows.map((r) => {
        const cond: Record<string, unknown> = { clientId: ctx.clientId };
        for (const f of spec.naturalKey) cond[f] = r[f];
        return cond;
    });
    const select = Object.fromEntries(spec.naturalKey.map((f) => [f, true]));
    const found: Raw[] = await delegate.findMany({ where: { OR }, select });
    const existing = new Set(found.map((r) => compositeKey(r, spec.naturalKey)));
    return { existing };
}

export async function runImport(input: ImportInput): Promise<ImportResult> {
    const { ctx, dataset: d, format, content, mode } = input;
    const spec = d.importSpec!;
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const importBatchId = crypto.randomUUID();

    const rawRows = parseRows(format, content);
    const { normalized, errors } = validate(d, rawRows);

    // Deduplicar por clave natural dentro del archivo (última gana).
    const dedup = new Map<string, Raw>();
    for (const r of normalized) dedup.set(compositeKey(r, spec.naturalKey), r);
    const unique = Array.from(dedup.values());

    const { existing } = await partitionExisting(d, ctx, unique);
    const toInsert = unique.filter((r) => !existing.has(compositeKey(r, spec.naturalKey))).length;
    const toUpdate = unique.length - toInsert;

    const preview: ImportPreview = {
        dataset: d.key,
        totalRows: rawRows.length,
        validRows: normalized.length,
        invalidRows: rawRows.length - normalized.length,
        toInsert,
        toUpdate,
        errors: errors.slice(0, 100),
        sampleNormalized: unique.slice(0, 5),
    };

    if (mode === 'dry-run') {
        return { ...preview, inserted: 0, updated: 0, skipped: 0, importBatchId };
    }

    // COMMIT: upsert por lotes, cada lote en su propia transacción (idempotente).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[d.model!];
    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < unique.length; i += spec.batchSize) {
        const batch = unique.slice(i, i + spec.batchSize);
        await prisma.$transaction(
            batch.map((row) => {
                const keyObj: Record<string, unknown> = { clientId: ctx.clientId };
                for (const f of spec.naturalKey) keyObj[f] = row[f];
                const data = { ...row, clientId: ctx.clientId };
                return delegate.upsert({
                    where: { [spec.uniqueWhereKey]: keyObj },
                    create: data,
                    update: row,
                });
            }),
        );
        for (const row of batch) {
            if (existing.has(compositeKey(row, spec.naturalKey))) updated++;
            else inserted++;
        }
    }

    return {
        ...preview,
        inserted,
        updated,
        skipped: 0,
        importBatchId,
    };
}

export function exportImportShaAndSize(content: string): { sha256: string; byteSize: number } {
    return {
        sha256: crypto.createHash('sha256').update(content).digest('hex'),
        byteSize: Buffer.byteLength(content, 'utf8'),
    };
}
