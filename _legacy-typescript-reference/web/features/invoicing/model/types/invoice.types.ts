/**
 * Invoice Types
 * Tipos específicos del dominio de facturación
 */

import { Invoice as PrismaInvoice, InvoiceStatus as PrismaInvoiceStatus, ReceiverType, DocumentType } from '@prisma/client';

export type Invoice = PrismaInvoice;
export type InvoiceStatus = PrismaInvoiceStatus;

export interface CreateInvoiceDTO {
    clientId: string;
    createdBy: string;
    clientReferenceId: string;

    issuerRuc: string;
    issuerDv: string;
    issuerName: string;
    issuerAddress: string;
    issuerEmail: string;
    issuerPhone?: string;

    receiverType: ReceiverType;
    receiverRuc?: string;
    receiverDv?: string;
    receiverName: string;
    receiverEmail?: string;
    receiverPhone?: string;
    receiverAddress?: string;

    documentType: DocumentType;
    pointOfSale?: string;
    paymentMethod?: string;
    paymentTerm?: string;

    subtotal: number;
    discount: number;
    subtotalAfterDiscount: number;
    itbms: number;
    total: number;

    issueDate: Date;
    dueDate: Date;

    notes?: string;
    internalNotes?: string;

    items: InvoiceItem[];
}

export interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount?: number;
    subtotal?: number;
    total?: number;
    unit?: string;
    code?: string;
    category?: string;
    type?: string;
    discount?: number;
    cpbsCode?: string | null;
    cpbsUnit?: string | null;
    productId?: string | null;
}

export interface ProcessInvoiceResult {
    invoice: Invoice;
    cufe: string;
    qrCode: string;
    approved: boolean;
}
