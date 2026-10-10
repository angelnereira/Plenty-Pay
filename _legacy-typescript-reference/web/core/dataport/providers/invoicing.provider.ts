/**
 * Provider de Facturación Fiscal. Las facturas emitidas son fiscales e
 * inmutables (export-only). Los clientes son datos maestros (importables).
 */

import { prismaServer as prisma } from '@core/database';
import type { DataProvider, DatasetDescriptor, TenantCtx, PeriodOpts } from '../contract';

const ITEMS_PAGE_SIZE = 500;

const datasets: DatasetDescriptor[] = [
    {
        key: 'invoices',
        label: 'Facturas',
        module: 'invoicing',
        version: '1',
        sensitivity: 'fiscal',
        mutability: 'immutable',
        model: 'invoice',
        periodField: 'issueDate',
        // Campos pesados/internos que no aportan a un export de datos:
        excludeFields: ['hkaResponseData', 'rawXml', 'pdfBase64', 'qrCode', 'phaseHistory', 'borradorData'],
    },
    {
        key: 'invoice_items',
        label: 'Ítems de factura',
        module: 'invoicing',
        version: '1',
        sensitivity: 'fiscal',
        mutability: 'immutable',
        dependsOn: ['invoices'],
        // InvoiceItem no tiene clientId propio — scope via relación a Invoice.
        customStream: async function* (ctx: TenantCtx, opts: PeriodOpts) {
            let cursor: string | undefined = undefined;
            for (;;) {
                // Tipado explícito para romper la inferencia circular cursor↔page.
                const page = (await prisma.invoiceItem.findMany({
                    where: {
                        invoice: {
                            clientId: ctx.clientId,
                            ...(opts.from || opts.to
                                ? {
                                    issueDate: {
                                        ...(opts.from ? { gte: new Date(`${opts.from}T00:00:00.000Z`) } : {}),
                                        ...(opts.to ? { lte: new Date(`${opts.to}T23:59:59.999Z`) } : {}),
                                    },
                                }
                                : {}),
                        },
                    },
                    orderBy: { id: 'asc' },
                    take: ITEMS_PAGE_SIZE,
                    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
                })) as Array<Record<string, unknown> & { id: string }>;
                if (page.length === 0) break;
                for (const item of page) yield item as Record<string, unknown>;
                if (page.length < ITEMS_PAGE_SIZE) break;
                cursor = page[page.length - 1].id;
            }
        },
    },
    {
        key: 'customers',
        label: 'Clientes (receptores)',
        module: 'invoicing',
        version: '1',
        sensitivity: 'pii',
        mutability: 'mutable',
        model: 'customer',
        periodField: 'createdAt',
        importSpec: {
            naturalKey: ['ruc', 'dv'],
            uniqueWhereKey: 'clientId_ruc_dv',
            allowedFields: ['ruc', 'dv', 'name', 'email', 'phone', 'address', 'province', 'district', 'clientType', 'rucType', 'isActive'],
            requiredFields: ['ruc', 'dv', 'name', 'address'],
            booleanFields: ['isActive'],
            batchSize: 200,
        },
    },
];

export const invoicingProvider: DataProvider = {
    module: 'invoicing',
    datasets: () => datasets,
};
