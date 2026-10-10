/**
 * Invoice Repository
 * Capa de acceso a datos - SOLO interactúa con Prisma
 */

import { prisma } from '@core/database';
import { notifyIfApproachingCap } from '@/lib/limits/invoice-cap';
import type { Invoice, CreateInvoiceDTO } from '../types';

export class InvoiceRepository {
    /**
     * Crear nueva factura en BD
     */
    async create(data: CreateInvoiceDTO): Promise<Invoice> {
        const invoice = await prisma.invoice.create({
            data: {
                // Core identification
                clientId: data.clientId,
                createdBy: data.createdBy,
                clientReferenceId: data.clientReferenceId,

                // Issuer data
                issuerRuc: data.issuerRuc,
                issuerDv: data.issuerDv,
                issuerName: data.issuerName,
                issuerAddress: data.issuerAddress,
                issuerEmail: data.issuerEmail,
                issuerPhone: data.issuerPhone || undefined,

                // Receiver data
                receiverType: data.receiverType,
                receiverRuc: data.receiverRuc || undefined,
                receiverDv: data.receiverDv || undefined,
                receiverName: data.receiverName,
                receiverEmail: data.receiverEmail || undefined,
                receiverPhone: data.receiverPhone || undefined,
                receiverAddress: data.receiverAddress || undefined,

                // Document info
                documentType: data.documentType,
                pointOfSale: data.pointOfSale || '001',
                paymentMethod: data.paymentMethod || 'CASH',
                paymentTerm: data.paymentTerm || 'CASH',

                // Amounts
                subtotal: data.subtotal,
                discount: data.discount || 0,
                subtotalAfterDiscount: data.subtotalAfterDiscount,
                itbms: data.itbms,
                total: data.total,
                currency: (data as any).currency || 'PAB',

                // Dates
                issueDate: data.issueDate || new Date(),
                dueDate: data.dueDate || undefined,

                // Notes
                notes: data.notes || undefined,
                internalNotes: data.internalNotes || undefined,

                // Status
                status: 'DRAFT',

                // Items
                items: {
                    create: data.items.map((item, index) => ({
                        lineNumber: index + 1,
                        code: item.code || item.type || '00',
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        unit: item.unit || 'UND',
                        discount: item.discount || 0,
                        discountRate: item.discount ? ((item.discount / (Number(item.unitPrice) * Number(item.quantity))) * 100) : 0,
                        taxRate: item.taxRate,
                        taxAmount: item.taxAmount ?? (Number(item.quantity) * Number(item.unitPrice) * (Number(item.taxRate) / 100)),
                        subtotal: item.subtotal ?? (Number(item.quantity) * Number(item.unitPrice)),
                        total: item.total ?? ((Number(item.quantity) * Number(item.unitPrice)) * (1 + Number(item.taxRate) / 100)),
                        cpbsCode: item.cpbsCode,
                        cpbsUnit: item.cpbsUnit,
                    })),
                },
            },
            include: {
                items: true,
            },
        });

        // Soft-cap mensual: avisar al admin si pasamos 80% / 100% del cap
        // del plan. No bloquea, no relanza si falla.
        void notifyIfApproachingCap(data.clientId);

        return invoice as any as Invoice;
    }

    /**
     * Obtener factura por ID
     */
    async findById(id: string): Promise<Invoice | null> {
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: { items: true },
        });

        return invoice;
    }

    /**
     * Actualizar estado de factura
     */
    async updateStatus(id: string, status: Invoice['status']): Promise<Invoice> {
        const invoice = await prisma.invoice.update({
            where: { id },
            data: { status },
            include: { items: true },
        });

        return invoice as any as Invoice;
    }

    /**
     * Guardar datos de HKA (CUFE, QR, URLs)
     */
    async saveHKAData(id: string, data: {
        cufe: string;
        qrCode: string;
        pdfUrl?: string;
        xmlUrl?: string;
    }): Promise<Invoice> {
        const invoice = await prisma.invoice.update({
            where: { id },
            data: {
                cufe: data.cufe,
                qrCode: data.qrCode,
                pdfUrl: data.pdfUrl,
                xmlUrl: data.xmlUrl,
                status: 'EMITTED', // Changed from 'AUTHORIZED' to match schema
                emittedAt: new Date(),
            },
            include: { items: true },
        });

        return invoice as any as Invoice;
    }

    // Helpers privados
    private calculateTotal(items: CreateInvoiceDTO['items']): number {
        return items.reduce((sum, item) =>
            sum + (item.quantity * item.unitPrice), 0
        );
    }

    private calculateTax(items: CreateInvoiceDTO['items']): number {
        return items.reduce((sum, item) =>
            sum + (item.quantity * item.unitPrice * item.taxRate), 0
        );
    }


}
