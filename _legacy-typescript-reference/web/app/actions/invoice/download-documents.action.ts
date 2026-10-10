'use server';

import { auth } from '@core/auth';
import { downloadPDFFromHKA, downloadXMLFromHKA } from '@/features/hka/model/methods/downloads';

/**
 * Server Action: Download Invoice PDF
 * Descarga el PDF oficial de una factura desde HKA
 * El PDF ya viene decodificado de base64 como Buffer
 */
export async function downloadInvoicePDF(numeroDocumentoFiscal: string) {
    try {
        // Autenti car usuario
        const session = await auth();
        if (!session?.user?.clientId) {
            return {
                success: false,
                error: 'No autenticado',
            };
        }

        const result = await downloadPDFFromHKA(session.user.clientId, {
            numeroDocumentoFiscal,
        });

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Error al descargar PDF',
            };
        }

        // Retornar el base64 para que el cliente lo maneje
        return {
            success: true,
            documentoBase64: result.documentoBase64,
            filename: result.filename,
            mimeType: result.mimeType,
        };
    } catch (error) {
        console.error('[downloadInvoicePDF] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
        };
    }
}

/**
 * Server Action: Download Invoice XML
 * Descarga el XML firmado de una factura desde HKA
 * El XML ya viene decodificado de base64 como string
 */
export async function downloadInvoiceXML(numeroDocumentoFiscal: string) {
    try {
        // Autenticar usuario
        const session = await auth();
        if (!session?.user?.clientId) {
            return {
                success: false,
                error: 'No autenticado',
            };
        }

        const result = await downloadXMLFromHKA(session.user.clientId, {
            numeroDocumentoFiscal,
        });

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'Error al descargar XML',
            };
        }

        // Retornar el base64 para que el cliente lo maneje
        return {
            success: true,
            documentoBase64: result.documentoBase64,
            contenido: result.contenido, // String decodificado
            filename: result.filename,
            mimeType: result.mimeType,
        };
    } catch (error) {
        console.error('[downloadInvoiceXML] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido',
        };
    }
}
