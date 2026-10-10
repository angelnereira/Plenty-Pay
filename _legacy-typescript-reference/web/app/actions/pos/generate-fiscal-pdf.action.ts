/**
 * Server Action: Generate Fiscal Invoice PDF
 * Generates a PDF document for fiscal invoices (with HKA/DGI data)
 * 
 * Features:
 * - Dynamic QR Code generation using cufe/qrCode
 * - Thermal receipt format (80mm)
 * - Business logo (if configured)
 * - Full HKA authorization data
 */

'use server';

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { pdfGeneratorService } from '@/lib/services/pdf-generator.service';
import type { FiscalInvoiceData } from '@/features/pos/ui/FiscalInvoicePDF';
import QRCode from 'qrcode';

export interface GenerateFiscalPDFInput {
    invoiceId: string;
}

export interface GenerateFiscalPDFOutput {
    success: boolean;
    data?: {
        pdfBase64: string;
        filename: string;
        mimeType: string;
    };
    error?: string;
}

/**
 * Generate QR Code as Base64 PNG
 * Uses the CUFE or a validation URL
 */
async function generateQRCode(data: string): Promise<string | undefined> {
    try {
        // Generate QR as Data URL, then extract base64
        const dataUrl = await QRCode.toDataURL(data, {
            width: 200,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
        // Remove the data:image/png;base64, prefix
        return dataUrl.replace(/^data:image\/png;base64,/, '');
    } catch (error) {
        console.error('[GenerateFiscalPDF] QR generation failed:', error);
        return undefined;
    }
}

/**
 * Generate PDF for a fiscal invoice
 * @param input - Invoice ID
 * @returns PDF as Base64 ready for client download
 */
export async function generateFiscalInvoicePDF(
    input: GenerateFiscalPDFInput
): Promise<GenerateFiscalPDFOutput> {
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
                customer: true, // Receiver customer data
            },
        });

        if (!invoice) {
            return { success: false, error: 'Factura no encontrada' };
        }

        // Verify it's a fiscal invoice (EMITTED status from HKA)
        if (!['EMITTED', 'PROCESSING'].includes(invoice.status)) {
            return {
                success: false,
                error: 'Solo se pueden generar PDFs fiscales para facturas aprobadas por la DGI',
            };
        }

        // Verify we have CUFE (required for fiscal)
        if (!invoice.cufe && invoice.status === 'EMITTED') {
            // If emitted but no CUFE, something is wrong, but we might show partial data or error
            // For now, strict check
            return {
                success: false,
                error: 'La factura no tiene CUFE asignado por la DGI',
            };
        }

        // Get business logo from settings (SystemConfig)
        let businessLogo: string | undefined;
        try {
            const logoConfig = await prisma.systemConfig.findUnique({
                where: {
                    clientId_key: {
                        clientId: clientId,
                        key: 'posBusinessLogo'
                    }
                }
            });

            if (logoConfig?.value) {
                // value is JSON stringified in ConfigService, let's parse it if needed
                // But in PosSettingsForm we save reader.result which is a string.
                // ConfigService.set does JSON.stringify(value).
                // So "data:image..." becomes "\"data:image...\""
                try {
                    businessLogo = JSON.parse(logoConfig.value);
                } catch {
                    businessLogo = logoConfig.value;
                }
            }
        } catch (e) {
            console.error("Error fetching logo", e);
        }

        // Generate QR Code from CUFE or qrCode URL
        const qrData = invoice.qrCode || invoice.cufe || '';
        const qrCodeBase64 = await generateQRCode(qrData);

        // Prepare PDF data
        const pdfData: FiscalInvoiceData = {
            // Business Info - Emisor
            businessName: invoice.client.name || invoice.issuerName,
            businessRuc: invoice.client.ruc || invoice.issuerRuc,
            businessDv: invoice.client.dv || invoice.issuerDv,
            businessAddress: invoice.client.address || invoice.issuerAddress,
            businessPhone: invoice.client.phone || invoice.issuerPhone || undefined,
            businessEmail: invoice.client.email || invoice.issuerEmail || undefined,
            businessLogo: businessLogo,

            // Document Info
            invoiceNumber: invoice.invoiceNumber || `FE-${invoice.id.slice(-8).toUpperCase()}`,
            issueDate: invoice.issueDate,

            // Client Info - Receptor
            clientName: invoice.receiverName || invoice.customer?.name || 'CONSUMIDOR FINAL',
            clientRuc: invoice.receiverRuc || invoice.customer?.ruc || undefined,
            clientDv: invoice.receiverDv || invoice.customer?.dv || undefined,
            clientAddress: invoice.receiverAddress || invoice.customer?.address || undefined,

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

            // HKA/DGI Data
            cufe: invoice.cufe || '',
            authProtocol: invoice.hkaProtocol || undefined,
            dgiDate: invoice.hkaProtocolDate || undefined,
            qrCodeBase64: qrCodeBase64,
        };

        // Generate PDF using the service
        let result = await pdfGeneratorService.generateFiscalInvoice(pdfData);

        // FALLBACK: If failed and we had a logo, try without logo (common cause of "Offset outside bounds")
        if (!result.success && pdfData.businessLogo) {
            console.warn('[GenerateFiscalPDF] PDF generation failed with logo, retrying without logo. Error:', result.error);
            pdfData.businessLogo = undefined;
            result = await pdfGeneratorService.generateFiscalInvoice(pdfData);
        }

        if (!result.success || !result.pdfBase64) {
            console.error('[GenerateFiscalPDF] Final failure:', result.error);
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
                message: 'PDF fiscal generado',
                userId: session.user.id,
                userEmail: session.user.email,
            },
        });

        const filename = `factura_${pdfData.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

        return {
            success: true,
            data: {
                pdfBase64: result.pdfBase64,
                filename,
                mimeType: 'application/pdf',
            },
        };
    } catch (error) {
        console.error('Error in generateFiscalInvoicePDF:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error interno del servidor',
        };
    }
}
