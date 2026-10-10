/**
 * Server Action: Download XML
 * Descarga el XML firmado digitalmente de una factura desde HKA
 */

'use server';

import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { downloadXMLFromHKA, type DescargarDocumentoResult } from '@/features/hka/model';

/**
 * Input para descarga
 */
export interface DownloadXMLInput {
  invoiceId: string;
}

/**
 * Output de descarga
 */
export interface DownloadXMLOutput {
  success: boolean;
  data?: {
    /** XML en Base64 */
    xmlBase64: string;
    /** XML como texto */
    xmlContent: string;
    /** Nombre del archivo */
    filename: string;
    /** Tipo MIME */
    mimeType: string;
  };
  error?: string;
}

/**
 * Descarga el XML firmado digitalmente de una factura desde HKA
 * 
 * @param input - ID de la factura
 * @returns XML en Base64 y como texto, listo para descarga
 */
export async function downloadInvoiceXML(input: DownloadXMLInput): Promise<DownloadXMLOutput> {
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
        rawXml: true,
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
        error: 'Solo se pueden descargar XMLs de facturas emitidas' 
      };
    }

    if (!invoice.invoiceNumber) {
      return { success: false, error: 'La factura no tiene número asignado' };
    }

    // Si ya tenemos el XML en cache, devolverlo
    if (invoice.rawXml) {
      return {
        success: true,
        data: {
          xmlBase64: Buffer.from(invoice.rawXml).toString('base64'),
          xmlContent: invoice.rawXml,
          filename: `factura_${invoice.invoiceNumber}.xml`,
          mimeType: 'application/xml',
        },
      };
    }

    // Descargar desde HKA
    const result = await downloadXMLFromHKA(clientId, {
      numeroDocumentoFiscal: invoice.invoiceNumber,
    });

    if (!result.success || !result.documentoBase64) {
      return {
        success: false,
        error: result.error || 'Error al descargar XML de HKA',
      };
    }

    // Guardar en cache para futuras descargas
    await prisma.invoice.update({
      where: { id: input.invoiceId },
      data: {
        rawXml: result.contenido,
        xmlDescargado: true,
      },
    });

    // Log de descarga
    await prisma.invoiceLog.create({
      data: {
        invoiceId: input.invoiceId,
        action: 'DOWNLOADED_XML',
        message: 'XML descargado desde HKA',
        userId: session.user.id,
        userEmail: session.user.email,
      },
    });

    return {
      success: true,
      data: {
        xmlBase64: result.documentoBase64,
        xmlContent: result.contenido || '',
        filename: result.filename || `factura_${invoice.invoiceNumber}.xml`,
        mimeType: result.mimeType || 'application/xml',
      },
    };
  } catch (error) {
    console.error('Error en downloadInvoiceXML:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    };
  }
}

/**
 * Descarga tanto PDF como XML de una factura
 */
export async function downloadInvoiceDocuments(invoiceId: string): Promise<{
  pdf: DownloadXMLOutput;
  xml: DownloadXMLOutput;
}> {
  const { downloadInvoicePDF } = await import('./download-pdf.action');
  
  const [pdfResult, xmlResult] = await Promise.all([
    downloadInvoicePDF({ invoiceId }),
    downloadInvoiceXML({ invoiceId }),
  ]);

  return {
    pdf: pdfResult as unknown as DownloadXMLOutput,
    xml: xmlResult,
  };
}

