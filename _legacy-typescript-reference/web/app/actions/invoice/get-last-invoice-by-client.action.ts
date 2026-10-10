'use server';

import { auth } from '@core/auth';
import { prismaServer } from '@core/database';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('GetLastInvoiceByClient');

// ============================================
// TYPES
// ============================================

export interface LastInvoiceSummary {
    invoiceId: string;
    invoiceNumber: string | null;
    emittedAt: string; // ISO string
    documentType: string; // e.g. 'FACTURA', 'FACTURA_EXPORTACION'
    noteSubtype: 'REFERENCED' | 'GENERIC' | null;
    paymentMethod: string | null;
    informacionInteres: string | null;
    totalAmount: number;
    items: Array<{
        id: string;
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate: string; // '00','01','02','03'
        cpbsCode?: string | null;
    }>;
    exportData?: {
        incoterm?: string | null;
    } | null;
}

type ActionResult =
    | { ok: true; data: LastInvoiceSummary }
    | { ok: true; data: null }
    | { ok: false; error: string };

// ============================================
// ACTION
// ============================================

export async function getLastInvoiceByClient(clientId: string): Promise<ActionResult> {
    const session = await auth();

    if (!session?.user?.id || !session?.user?.clientId) {
        return { ok: false, error: 'No autorizado' };
    }

    try {
        const invoice = await prismaServer.invoice.findFirst({
            where: {
                clientId: session.user.clientId,
                customerId: clientId,
                status: {
                    in: ['EMITTED', 'CERTIFIED'],
                },
            },
            orderBy: {
                emittedAt: 'desc',
            },
            include: {
                items: true,
            },
        });

        if (!invoice) {
            return { ok: true, data: null };
        }

        const summary: LastInvoiceSummary = {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber ?? null,
            emittedAt: (invoice.emittedAt ?? invoice.createdAt).toISOString(),
            documentType: invoice.documentType.toString(),
            noteSubtype: invoice.noteSubtype
                ? (invoice.noteSubtype.toString() as 'REFERENCED' | 'GENERIC')
                : null,
            paymentMethod: invoice.paymentMethod ?? null,
            informacionInteres: invoice.notes ?? null,
            totalAmount: Number(invoice.total),
            items: invoice.items.map((item) => ({
                id: item.id,
                description: item.description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                taxRate: item.taxCode,
                cpbsCode: item.cpbsCode ?? null,
            })),
            exportData:
                invoice.exportIncoterm !== undefined
                    ? { incoterm: invoice.exportIncoterm ?? null }
                    : null,
        };

        logger.debug({ invoiceId: invoice.id, customerId: clientId }, 'Last invoice found');

        return { ok: true, data: summary };
    } catch (error: unknown) {
        logger.error({ err: error, clientId }, 'Failed to get last invoice by client');
        const errorMessage =
            error instanceof Error ? error.message : 'Error al obtener última factura';
        return { ok: false, error: errorMessage };
    }
}
