/**
 * core/dataport/engine.ts
 *
 * Motor genérico de lectura para export: streaming por cursor, scoping forzado
 * por tenant, filtro por período, exclusión de campos sensibles y orden
 * determinista. Convierte tipos Prisma (Decimal/Date/BigInt) a primitivos
 * serializables.
 */

import { prismaServer as prisma } from '@core/database';
import type { DatasetDescriptor, TenantCtx, PeriodOpts } from './contract';

const PAGE_SIZE = 500;

/** Convierte un valor de Prisma a algo serializable en CSV/JSON. */
export function normalizeValue(v: unknown): string | number | boolean | null {
    if (v === null || v === undefined) return null;
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'object') {
        // Prisma.Decimal expone toNumber()
        const maybeDecimal = v as { toNumber?: () => number };
        if (typeof maybeDecimal.toNumber === 'function') {
            const n = maybeDecimal.toNumber();
            return Number.isFinite(n) ? n : String(v);
        }
        // Buffer/array/objeto → JSON
        return JSON.stringify(v);
    }
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
    return String(v);
}

/** Normaliza una fila completa, excluyendo campos sensibles. */
function sanitizeRow(
    row: Record<string, unknown>,
    excludeFields?: string[],
): Record<string, string | number | boolean | null> {
    const exclude = new Set(excludeFields ?? []);
    const out: Record<string, string | number | boolean | null> = {};
    for (const [k, v] of Object.entries(row)) {
        if (exclude.has(k)) continue;
        out[k] = normalizeValue(v);
    }
    return out;
}

function buildWhere(d: DatasetDescriptor, ctx: TenantCtx, opts: PeriodOpts): Record<string, unknown> {
    const tenantField = d.tenantField ?? 'clientId';
    const where: Record<string, unknown> = { [tenantField]: ctx.clientId };
    if (d.periodField && (opts.from || opts.to)) {
        where[d.periodField] = {
            ...(opts.from ? { gte: new Date(`${opts.from}T00:00:00.000Z`) } : {}),
            ...(opts.to ? { lte: new Date(`${opts.to}T23:59:59.999Z`) } : {}),
        };
    }
    return where;
}

/**
 * Stream de filas de un dataset. SIEMPRE scoped por `ctx.clientId`.
 * Usa el `customStream` del descriptor si existe; si no, pagina el modelo
 * Prisma por cursor sobre un campo de orden estable (default `id`).
 */
export async function* streamDataset(
    d: DatasetDescriptor,
    ctx: TenantCtx,
    opts: PeriodOpts,
): AsyncIterable<Record<string, string | number | boolean | null>> {
    if (d.customStream) {
        for await (const row of d.customStream(ctx, opts)) {
            yield sanitizeRow(row, d.excludeFields);
        }
        return;
    }

    if (!d.model) throw new Error(`Dataset ${d.key}: falta 'model' o 'customStream'`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[d.model];
    if (!delegate?.findMany) throw new Error(`Dataset ${d.key}: modelo Prisma '${d.model}' inexistente`);

    const where = buildWhere(d, ctx, opts);
    const orderField = d.orderBy ?? 'id';
    let cursor: unknown = undefined;

    for (;;) {
        const page: Record<string, unknown>[] = await delegate.findMany({
            where,
            orderBy: { [orderField]: 'asc' },
            take: PAGE_SIZE,
            ...(cursor !== undefined ? { skip: 1, cursor: { [orderField]: cursor } } : {}),
        });
        if (page.length === 0) break;
        for (const row of page) yield sanitizeRow(row, d.excludeFields);
        if (page.length < PAGE_SIZE) break;
        cursor = page[page.length - 1][orderField];
        if (cursor === undefined) break; // defensa: sin campo de orden no se puede paginar
    }
}

/** Conteo estimado (para guarda de presupuesto). */
export async function estimateCount(
    d: DatasetDescriptor,
    ctx: TenantCtx,
    opts: PeriodOpts,
): Promise<number> {
    if (d.customStream || !d.model) return -1; // desconocido
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (prisma as any)[d.model];
    if (!delegate?.count) return -1;
    return delegate.count({ where: buildWhere(d, ctx, opts) });
}
