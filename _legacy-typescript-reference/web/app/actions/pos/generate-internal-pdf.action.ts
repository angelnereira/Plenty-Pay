/**
 * Server Action: Generate Internal Invoice PDF
 * Generates a PDF document for internal invoices (non-fiscal)
 */

'use server';

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { pdfGeneratorService } from '@/lib/services/pdf-generator.service';
import type { InternalInvoiceData } from '@/features/pos/ui/InternalInvoicePDF';

export interface GenerateInternalPDFInput {
    invoiceId: string;
}

export interface GenerateInternalPDFOutput {
    success: boolean;
    data?: {
        pdfBase64: string;
        filename: string;
        mimeType: string;
    };
    error?: string;
}

/**
 * Generate PDF for an internal invoice
 * @param input - Invoice ID
 * @returns PDF as Base64 ready for client download
 */
export async function generateInternalInvoicePDF(
    input: GenerateInternalPDFInput
): Promise<GenerateInternalPDFOutput> {
    try {
        // Authentication
        const session = await auth();
        if (!session?.user?.id || !session?.user?.clientId) {
            return { success: false, error: 'No autorizado' };
        }

        const { clientId } = session.user;

        // Get invoice with items and client info
        const invoice = await prisma.invoice.findFirst({
            where: {
                id: input.invoiceId,
                clientId: clientId,
            },
            include: {
                items: {
                    orderBy: { lineNumber: 'asc' },
                },
                client: true,
            },
        });

        if (!invoice) {
            return { success: false, error: 'Factura no encontrada' };
        }

        // Verify it's an internal invoice or draft
        if (!['INTERNAL', 'DRAFT'].includes(invoice.status)) {
            return {
                success: false,
                error: 'Solo se pueden generar PDFs internos para facturas internas',
            };
        }

        // Prepare PDF data
        const pdfData: InternalInvoiceData = {
            // Business Info
            businessName: invoice.client.name || invoice.issuerName,
            businessRuc: invoice.client.ruc || invoice.issuerRuc,
            businessDv: invoice.client.dv || invoice.issuerDv,
            businessAddress: invoice.client.address || invoice.issuerAddress,
            businessPhone: invoice.client.phone || invoice.issuerPhone || undefined,
            businessEmail: invoice.client.email || invoice.issuerEmail || undefined,

            // Document Info
            documentNumber: invoice.invoiceNumber || `INT-${invoice.id.slice(-8).toUpperCase()}`,
            issueDate: invoice.issueDate,

            // Client Info
            clientName: invoice.receiverName || 'CONSUMIDOR FINAL',
            clientRuc: invoice.receiverRuc || undefined,

            // Items
            items: invoice.items.map((item) => ({
                quantity: Number(item.quantity),
                description: item.description,
                unitPrice: Number(item.unitPrice),
                total: Number(item.total),
            })),

            // Totals
            subtotal: Number(invoice.subtotal),
            discount: Number(invoice.discount) || 0,
            itbms: Number(invoice.itbms),
            total: Number(invoice.total),

            // Payment
            paymentMethod: invoice.paymentMethod || 'CASH',

            // Notes
            notes: invoice.notes || undefined,
        };

        // Generate PDF
        const result = await pdfGeneratorService.generateInternalInvoice(pdfData);

        if (!result.success || !result.pdfBase64) {
            return {
                success: false,
                error: result.error || 'Error al generar PDF',
            };
        }

        // Log the generation
        await prisma.invoiceLog.create({
            data: {
                invoiceId: input.invoiceId,
                action: 'DOWNLOADED_PDF',
                message: 'PDF interno generado',
                userId: session.user.id,
                userEmail: session.user.email,
            },
        });

        const filename = `factura_interna_${pdfData.documentNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

        return {
            success: true,
            data: {
                pdfBase64: result.pdfBase64,
                filename,
                mimeType: 'application/pdf',
            },
        };
    } catch (error) {
        console.error('Error in generateInternalInvoicePDF:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error interno del servidor',
        };
    }
}
