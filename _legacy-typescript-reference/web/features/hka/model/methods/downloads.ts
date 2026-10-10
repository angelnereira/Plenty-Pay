/**
 * HKA Web Service - Métodos DescargaPDF y DescargaXML
 * 
 * Descarga documentos firmados de facturas emitidas
 * según HKA_Documentacion_Completa.md
 */

import { descargarPDF, descargarXML } from '../services/hka-soap.service';
import { getHKAConfig } from '../repositories/hka-config.repository';
import { decodeBase64Document, decodeBase64ToString } from '../services/hka-parser.service';
import type {
  HKAResponse,
  DescargaResponse,
  DatosDocumento,
  HKAConfig,
  TipoDocumento,
  TipoEmision,
} from '../types/types';
import { DatosDocumentoSchema } from '../types/types';
import { buildDatosDocumento, type DatosDocumentoInput } from './shared';

/**
 * Entrada para descargar documentos
 */
export interface DescargarDocumentoInput extends DatosDocumentoInput { }

/**
 * Resultado de descarga de documento
 */
export interface DescargarDocumentoResult {
  /** Descarga exitosa */
  success: boolean;
  /** Contenido del documento en Base64 */
  documentoBase64?: string;
  /** Contenido decodificado como Buffer (para PDF) */
  buffer?: Buffer;
  /** Contenido decodificado como string (para XML) */
  contenido?: string;
  /** Tipo MIME del documento */
  mimeType?: string;
  /** Nombre sugerido para el archivo */
  filename?: string;
  /** Mensaje de error si falla */
  error?: string;
  /** Código de respuesta HKA */
  code?: string;
}

/**
 * Descarga el PDF oficial de una factura emitida
 * El PDF incluye código QR y toda la información fiscal
 * 
 * @param clientId - ID del cliente
 * @param input - Datos del documento a descargar
 * @returns Documento PDF en Base64 y Buffer
 * 
 * @example
 * const result = await downloadPDFFromHKA(clientId, {
 *   numeroDocumentoFiscal: '0000000176'
 * });
 * 
 * if (result.success && result.buffer) {
 *   // Guardar archivo o enviarlo al cliente
 *   fs.writeFileSync('factura.pdf', result.buffer);
 * }
 */
export async function downloadPDFFromHKA(
  clientId: string,
  input: DescargarDocumentoInput
): Promise<DescargarDocumentoResult> {
  try {
    // Obtener configuración HKA
    const config = await getHKAConfig(clientId);

    // Construir DatosDocumento
    const datosDocumento = buildDatosDocumento(input, config);

    // Validar
    const validation = DatosDocumentoSchema.safeParse(datosDocumento);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Datos del documento inválidos',
      };
    }

    // Llamar al servicio HKA
    const response = await descargarPDF(config, datosDocumento);

    // Procesar respuesta
    return processPDFResponse(response, datosDocumento.numeroDocumentoFiscal);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Descarga el XML firmado digitalmente de una factura emitida
 * El XML contiene toda la información fiscal con firma digital
 * 
 * @param clientId - ID del cliente
 * @param input - Datos del documento a descargar
 * @returns Documento XML en Base64 y string
 */
export async function downloadXMLFromHKA(
  clientId: string,
  input: DescargarDocumentoInput
): Promise<DescargarDocumentoResult> {
  try {
    // Obtener configuración HKA
    const config = await getHKAConfig(clientId);

    // Construir DatosDocumento
    const datosDocumento = buildDatosDocumento(input, config);

    // Validar
    const validation = DatosDocumentoSchema.safeParse(datosDocumento);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Datos del documento inválidos',
      };
    }

    // Llamar al servicio HKA
    const response = await descargarXML(config, datosDocumento);

    // Procesar respuesta
    return processXMLResponse(response, datosDocumento.numeroDocumentoFiscal);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Descarga PDF usando configuración pre-cargada
 */
export async function downloadPDFWithConfig(
  config: HKAConfig,
  datosDocumento: DatosDocumento
): Promise<DescargarDocumentoResult> {
  try {
    const validation = DatosDocumentoSchema.safeParse(datosDocumento);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Datos del documento inválidos',
      };
    }

    const response = await descargarPDF(config, datosDocumento);
    return processPDFResponse(response, datosDocumento.numeroDocumentoFiscal);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Descarga XML usando configuración pre-cargada
 */
export async function downloadXMLWithConfig(
  config: HKAConfig,
  datosDocumento: DatosDocumento
): Promise<DescargarDocumentoResult> {
  try {
    const validation = DatosDocumentoSchema.safeParse(datosDocumento);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Datos del documento inválidos',
      };
    }

    const response = await descargarXML(config, datosDocumento);
    return processXMLResponse(response, datosDocumento.numeroDocumentoFiscal);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Construye el objeto DatosDocumento
 */
// buildDatosDocumento imported from './shared'

/**
 * Procesa la respuesta de descarga PDF
 */
function processPDFResponse(
  response: HKAResponse<DescargaResponse>,
  numeroDocumento: string
): DescargarDocumentoResult {
  if (!response.success) {
    return {
      success: false,
      error: response.message || 'Error al descargar PDF de HKA',
      code: response.code,
    };
  }

  if (!response.data?.documento) {
    return {
      success: false,
      error: 'Sin documento en la respuesta de HKA',
      code: response.code,
    };
  }

  try {
    const buffer = decodeBase64Document(response.data.documento);

    return {
      success: true,
      documentoBase64: response.data.documento,
      buffer,
      mimeType: 'application/pdf',
      filename: `factura_${numeroDocumento}.pdf`,
      code: response.code,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Error al decodificar el PDF',
      code: response.code,
    };
  }
}

/**
 * Procesa la respuesta de descarga XML
 */
function processXMLResponse(
  response: HKAResponse<DescargaResponse>,
  numeroDocumento: string
): DescargarDocumentoResult {
  if (!response.success) {
    return {
      success: false,
      error: response.message || 'Error al descargar XML de HKA',
      code: response.code,
    };
  }

  if (!response.data?.documento) {
    return {
      success: false,
      error: 'Sin documento en la respuesta de HKA',
      code: response.code,
    };
  }

  try {
    const buffer = decodeBase64Document(response.data.documento);
    const contenido = decodeBase64ToString(response.data.documento);

    return {
      success: true,
      documentoBase64: response.data.documento,
      buffer,
      contenido,
      mimeType: 'application/xml',
      filename: `factura_${numeroDocumento}.xml`,
      code: response.code,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Error al decodificar el XML',
      code: response.code,
    };
  }
}

/**
 * Descarga ambos documentos (PDF y XML) de una factura
 * 
 * @param clientId - ID del cliente
 * @param input - Datos del documento
 * @returns Objeto con resultados de PDF y XML
 */
export async function downloadBothDocuments(
  clientId: string,
  input: DescargarDocumentoInput
): Promise<{
  pdf: DescargarDocumentoResult;
  xml: DescargarDocumentoResult;
}> {
  // Obtener configuración una sola vez
  const config = await getHKAConfig(clientId);
  const datosDocumento = buildDatosDocumento(input, config);

  // Descargar ambos en paralelo
  const [pdfResult, xmlResult] = await Promise.all([
    downloadPDFWithConfig(config, datosDocumento),
    downloadXMLWithConfig(config, datosDocumento),
  ]);

  return {
    pdf: pdfResult,
    xml: xmlResult,
  };
}

/**
 * Crea una respuesta HTTP con el archivo para descarga
 * Útil para API routes
 * 
 * @param result - Resultado de la descarga
 * @returns Headers y body para la respuesta HTTP
 */
export function createDownloadResponse(result: DescargarDocumentoResult): {
  headers: Record<string, string>;
  body: Buffer | null;
} {
  if (!result.success || !result.buffer) {
    return {
      headers: { 'Content-Type': 'application/json' },
      body: null,
    };
  }

  return {
    headers: {
      'Content-Type': result.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${result.filename || 'documento'}"`,
      'Content-Length': String(result.buffer.length),
    },
    body: result.buffer,
  };
}

