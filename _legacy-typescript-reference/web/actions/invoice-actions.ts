'use server'

import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { getAccumulatedItbms } from "@/lib/fiscal/itbms"

export interface InvoiceItem {
    id: string
    description: string
    quantity: number
    unitPrice: number
    total: number
    taxAmount: number
}

export interface Invoice {
    id: string
    folio: string
    invoiceNumber?: string
    clientName: string
    receiverName: string
    clientRuc: string
    receiverRuc?: string
    total: number
    subtotal: number
    itbms: number
    currency: string
    status: string
    documentType?: string
    cufe?: string
    cafe?: string
    qrCode?: string
    qrUrl?: string
    createdAt: Date
    emittedAt?: Date
    issueDate: Date
    receiverEmail?: string
    receiverDv?: string
    items: InvoiceItem[]
}

export interface InvoiceStats {
    total: number
    emitted: number
    draft: number
    processing: number
    error: number
    canceled: number
    totalAmount: number
    /**
     * ITBMS acumulado a pagar (todo el histórico, solo facturas de venta
     * emitidas con éxito). Se calcula con un agregado server-side, NO con el
     * reduce sobre la lista —que está limitada a 200 facturas—.
     */
    totalItbms: number
}

export interface InvoicesData {
    invoices: Invoice[]
    stats: InvoiceStats
}

export async function getInvoices(): Promise<{ success: boolean; data?: InvoicesData; error?: string }> {
    try {
        const session = await auth()

        if (!session || !session.user || !session.user.clientId) {
            return { success: false, error: 'Unauthorized' }
        }

        const clientId = session.user.clientId

        // ITBMS acumulado a pagar — agregado server-side sobre TODO el histórico
        // (no depende del `take: 200` de la lista). Se lanza en paralelo abajo.
        const accumulatedItbmsPromise = getAccumulatedItbms({ clientId })

        // Obtener facturas con items - Query optimizada con select específico
        const rawInvoices = await prisma.invoice.findMany({
            where: {
                clientId,
            },
            select: {
                id: true,
                invoiceNumber: true,
                receiverName: true,
                receiverRuc: true,
                receiverEmail: true,
                receiverDv: true,
                total: true,
                subtotal: true,
                itbms: true,
                currency: true,
                status: true,
                documentType: true,
                cufe: true,
                cafe: true,
                qrCode: true,
                qrUrl: true,
                createdAt: true,
                emittedAt: true,
                issueDate: true,
                items: {
                    select: {
                        id: true,
                        description: true,
                        quantity: true,
                        unitPrice: true,
                        total: true,
                        taxAmount: true,
                    }
                }
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 200,
        })

        // Calcular estadísticas (usando los datos crudos antes de transformar)
        const stats: InvoiceStats = {
            total: rawInvoices.length,
            emitted: rawInvoices.filter((inv) =>
                inv.status === "EMITTED" || inv.status === "CERTIFIED"
            ).length,
            draft: rawInvoices.filter((inv) => inv.status === "DRAFT").length,
            processing: rawInvoices.filter((inv) =>
                inv.status === "PROCESSING" || inv.status === "QUEUED"
            ).length,
            error: rawInvoices.filter((inv) =>
                inv.status === "ERROR" || inv.status === "REJECTED"
            ).length,
            canceled: rawInvoices.filter((inv) =>
                inv.status === "CANCELLED"
            ).length,
            totalAmount: rawInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0),
            totalItbms: await accumulatedItbmsPromise,
        }

        // Transformar para el componente
        const transformedInvoices: Invoice[] = rawInvoices.map((invoice) => ({
            id: invoice.id,
            folio: invoice.invoiceNumber || "N/A",
            invoiceNumber: invoice.invoiceNumber || undefined,
            clientName: invoice.receiverName || "Cliente",
            receiverName: invoice.receiverName || "Cliente",
            clientRuc: invoice.receiverRuc || "N/A",
            receiverRuc: invoice.receiverRuc || undefined,
            total: Number(invoice.total) || 0,
            subtotal: Number(invoice.subtotal) || 0,
            itbms: Number(invoice.itbms) || 0,
            currency: invoice.currency || "PAB",
            status: invoice.status || "DRAFT",
            documentType: invoice.documentType || undefined,
            cufe: invoice.cufe || undefined,
            cafe: invoice.cafe || undefined,
            qrCode: invoice.qrCode || undefined,
            qrUrl: invoice.qrUrl || undefined,
            createdAt: invoice.createdAt,
            emittedAt: invoice.emittedAt || undefined,
            issueDate: invoice.issueDate || invoice.createdAt,
            receiverEmail: invoice.receiverEmail || undefined,
            receiverDv: invoice.receiverDv || undefined,
            items: invoice.items.map(item => ({
                id: item.id,
                description: item.description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                total: Number(item.total),
                taxAmount: Number(item.taxAmount),
            })),
        }))

        return {
            success: true,
            data: {
                invoices: transformedInvoices,
                stats
            }
        }

    } catch (error) {
        console.error('[Action] Error fetching invoices:', error)
        return { success: false, error: 'Failed to fetch invoices' }
    }
}
