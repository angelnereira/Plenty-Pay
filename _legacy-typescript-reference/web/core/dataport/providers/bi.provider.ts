/**
 * Provider de Reportes y BI. BI es analítica derivada: exponemos el agregado
 * de ventas diarias desde la vista materializada `mv_bi_sales_daily` mediante
 * un customStream (SQL crudo), reutilizando la infra BI existente.
 */

import { Prisma } from '@prisma/client';
import { prismaServer as prisma } from '@core/database';
import type { DataProvider, DatasetDescriptor, TenantCtx, PeriodOpts } from '../contract';

async function* salesDailyStream(ctx: TenantCtx, opts: PeriodOpts): AsyncIterable<Record<string, unknown>> {
    const from = opts.from ? new Date(`${opts.from}T00:00:00.000Z`) : new Date('1970-01-01T00:00:00.000Z');
    const to = opts.to ? new Date(`${opts.to}T23:59:59.999Z`) : new Date('9999-12-31T23:59:59.999Z');
    // La vista materializada usa snake_case: "client_id", "day".
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT *
        FROM "mv_bi_sales_daily"
        WHERE "client_id" = ${ctx.clientId}
          AND "day" >= ${from} AND "day" <= ${to}
        ORDER BY "day" ASC
    `);
    for (const row of rows) yield row;
}

const datasets: DatasetDescriptor[] = [
    {
        key: 'bi_sales_daily',
        label: 'Ventas diarias (BI)',
        module: 'bi',
        version: '1',
        sensitivity: 'normal',
        mutability: 'immutable',
        customStream: salesDailyStream,
    },
];

export const biProvider: DataProvider = {
    module: 'bi',
    datasets: () => datasets,
};
