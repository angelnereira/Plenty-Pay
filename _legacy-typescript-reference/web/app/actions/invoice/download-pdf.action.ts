/**
 * Server Action: Download PDF
 * Descarga el PDF oficial de una factura desde HKA
 */

'use server';

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { downloadPDFFromHKA, type DescargarDocumentoResult } from '@/features/hka/model';

/**
 * Input para descarga
 */
export interface DownloadPDFInput {
  invoiceId: string;
}

/**
 * Output de descarga
 */
export interface DownloadPDFOutput {
  success: boolean;
  data?: {
    /** PDF en Base64 */
    pdfBase64: string;
    /** Nombre del archivo */
    filename: string;
    /** Tipo MIME */
    mimeType: string;
  };
  error?: string;
}

/**
 * Descarga el PDF oficial de una factura desde HKA
 * 
 * @param input - ID de la factura
 * @returns PDF en Base64 listo para descarga en el cliente
 */
export async function downloadInvoicePDF(input: DownloadPDFInput): Promise<DownloadPDFOutput> {
  try {
    // Autenticación
    const session = await auth();
    if (!session?.user?.id || !session?.user?.clientId) {
      return { success: false, error: 'No autorizado' };
    }

    const { clientId } = session.user;

    // Obtener factura
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: input.invoiceId,
        clientId: clientId,
      },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        pdfBase64: true,
        cufe: true,
      },
    });

    if (!invoice) {
      return { success: false, error: 'Factura no encontrada' };
    }

    // Verificar que la factura esté emitida
    if (!['EMITTED', 'CERTIFIED', 'CANCELLED'].includes(invoice.status)) {
      return { 
        success: false, 
        error: 'Solo se pueden descargar PDFs de facturas emitidas' 
      };
    }

    if (!invoice.invoiceNumber) {
      return { success: false, error: 'La factura no tiene número asignado' };
    }

    // Si ya tenemos el PDF en cache, devolverlo
    if (invoice.pdfBase64) {
      return {
        success: true,
        data: {
          pdfBase64: invoice.pdfBase64,
          filename: `factura_${invoice.invoiceNumber}.pdf`,
          mimeType: 'application/pdf',
        },
      };
    }

    // Descargar desde HKA
    const result = await downloadPDFFromHKA(clientId, {
      numeroDocumentoFiscal: invoice.invoiceNumber,
    });

    if (!result.success || !result.documentoBase64) {
      return {
        success: false,
        error: result.error || 'Error al descargar PDF de HKA',
      };
    }

    // Guardar en cache para futuras descargas
    await prisma.invoice.update({
      where: { id: input.invoiceId },
      data: {
        pdfBase64: result.documentoBase64,
        pdfDescargado: true,
      },
    });

    // Log de descarga
    await prisma.invoiceLog.create({
      data: {
        invoiceId: input.invoiceId,
        action: 'DOWNLOADED_PDF',
        message: 'PDF descargado desde HKA',
        userId: session.user.id,
        userEmail: session.user.email,
      },
    });

    return {
      success: true,
      data: {
        pdfBase64: result.documentoBase64,
        filename: result.filename || `factura_${invoice.invoiceNumber}.pdf`,
        mimeType: result.mimeType || 'application/pdf',
      },
    };
  } catch (error) {
    console.error('Error en downloadInvoicePDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}

/**
 * Genera URL de descarga temporal para el PDF
 * (Para uso con API routes)
 */
export async function getPDFDownloadUrl(invoiceId: string): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  // Por ahora retornamos la ruta del API route
  const session = await auth();
  if (!session?.user?.clientId) {
    return { success: false, error: 'No autorizado' };
  }

  return {
    success: true,
    url: `/api/invoices/${invoiceId}/pdf`,
  };
}
