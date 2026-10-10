/**
 * HKA Web Service - Método Enviar
 * 
 * El método principal para crear y enviar facturas electrónicas a HKA
 * según HKA_Documentacion_Completa.md
 */

import { enviarFactura as sendToHKA } from '../services/hka-soap.service';
import { getHKAConfig } from '../repositories/hka-config.repository';
import {
  mapInvoiceToHKA,
  validateInvoiceForHKA,
  type InvoiceWithRelations,
  type MapperOptions,
} from '../mappers/invoice-to-hka';
import type {
  HKAResponse,
  EnviarResponse,
  DocumentoElectronico,
  HKAConfig,
} from '../types/types';
import { validateCUFE } from '../services/utils';

/**
 * Resultado de emisión de factura
 */
export interface EmitirFacturaResult {
  /** Emisión exitosa */
  success: boolean;
  /** CUFE - Código Único de Factura Electrónica (66 caracteres) */
  cufe?: string;
  /** URL del código QR para verificación */
  qrUrl?: string;
  /** Número de protocolo asignado por la DGI */
  nroProtocoloAutorizacion?: string;
  /** Fecha y hora de autorización por la DGI */
  fechaRecepcionDGI?: string;
  /** Mensaje de error si falla */
  error?: string;
  /** Errores de validación si los hay */
  validationErrors?: string[];
  /** Código de respuesta HKA */
  code?: string;
}

/**
 * Emite una factura electrónica a través de HKA
 * Este es el método principal y más importante del servicio
 * 
 * @param clientId - ID del cliente para obtener configuración HKA
 * @param invoice - Factura de Prisma con items y customer
 * @param options - Opciones adicionales de mapeo
 * @returns Resultado con CUFE, QR y protocolo si es exitoso
 * 
 * @example
 * const result = await emitirFactura(clientId, invoiceWithItems);
 * 
 * if (result.success) {
 *   // Guardar CUFE y QR en la base de datos
 *   await prisma.invoice.update({
 *     where: { id: invoice.id },
 *     data: {
 *       cufe: result.cufe,
 *       qrUrl: result.qrUrl,
 *       hkaProtocol: result.nroProtocoloAutorizacion,
 *       status: 'EMITTED',
 *     }
 *   });
 * }
 */
export async function emitirFactura(
  clientId: string,
  invoice: InvoiceWithRelations,
  options: MapperOptions = {}
): Promise<EmitirFacturaResult> {
  try {
    // 1. Validar que la factura tiene los datos necesarios
    const validation = validateInvoiceForHKA(invoice);
    if (!validation.valid) {
      return {
        success: false,
        error: 'La factura no cumple los requisitos para emisión',
        validationErrors: validation.errors,
      };
    }

    // 2. Obtener configuración HKA del cliente
    const config = await getHKAConfig(clientId);

    // 3. Mapear factura al formato HKA
    const documento = mapInvoiceToHKA(invoice, config, options);

    // 4. Enviar a HKA
    const response = await sendToHKA(config, documento);

    // 5. Procesar respuesta
    return processEnviarResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al emitir factura',
    };
  }
}

/**
 * Emite factura usando configuración pre-cargada
 */
export async function emitirFacturaWithConfig(
  config: HKAConfig,
  invoice: InvoiceWithRelations,
  options: MapperOptions = {}
): Promise<EmitirFacturaResult> {
  try {
    // Validar
    const validation = validateInvoiceForHKA(invoice);
    if (!validation.valid) {
      return {
        success: false,
        error: 'La factura no cumple los requisitos para emisión',
        validationErrors: validation.errors,
      };
    }

    // Mapear y enviar
    const documento = mapInvoiceToHKA(invoice, config, options);
    const response = await sendToHKA(config, documento);

    return processEnviarResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Emite factura usando documento pre-construido
 * Útil cuando ya tienes el DocumentoElectronico armado
 */
export async function emitirDocumento(
  clientId: string,
  documento: DocumentoElectronico
): Promise<EmitirFacturaResult> {
  try {
    const config = await getHKAConfig(clientId);
    const response = await sendToHKA(config, documento);
    return processEnviarResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Emite documento con configuración pre-cargada
 */
export async function emitirDocumentoWithConfig(
  config: HKAConfig,
  documento: DocumentoElectronico
): Promise<EmitirFacturaResult> {
  try {
    const response = await sendToHKA(config, documento);
    return processEnviarResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Procesa la respuesta del método Enviar
 */
function processEnviarResponse(
  response: HKAResponse<EnviarResponse>
): EmitirFacturaResult {
  if (!response.success) {
    return {
      success: false,
      error: response.message || 'Error al enviar factura a HKA',
      code: response.code,
    };
  }

  if (!response.data) {
    return {
      success: false,
      error: 'Respuesta de HKA sin datos',
      code: response.code,
    };
  }

  const { cufe, qr, nroProtocoloAutorizacion, fechaRecepcionDGI } = response.data;

  // Validar CUFE (66 caracteres exactos)
  if (!validateCUFE(cufe)) {
    console.warn('[HKA] Invalid CUFE length:', cufe?.length, cufe);
  }

  return {
    success: true,
    cufe,
    qrUrl: qr,
    nroProtocoloAutorizacion,
    fechaRecepcionDGI,
    code: response.code,
  };
}

/**
 * Emite múltiples facturas en lote
 * 
 * @param clientId - ID del cliente
 * @param invoices - Array de facturas a emitir
 * @returns Array de resultados
 */
export async function emitirFacturasBatch(
  clientId: string,
  invoices: InvoiceWithRelations[]
): Promise<{ invoiceId: string; result: EmitirFacturaResult }[]> {
  // Obtener configuración una sola vez
  const config = await getHKAConfig(clientId);

  const results: { invoiceId: string; result: EmitirFacturaResult }[] = [];

  for (const invoice of invoices) {
    const result = await emitirFacturaWithConfig(config, invoice);
    results.push({ invoiceId: invoice.id, result });

    // Pausa entre emisiones para evitar sobrecargar el servicio
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Prepara una factura para emisión (solo mapea, no envía)
 * Útil para preview o validación
 * 
 * @param clientId - ID del cliente
 * @param invoice - Factura a preparar
 * @returns Documento HKA listo para enviar
 */
export async function prepareInvoiceForEmission(
  clientId: string,
  invoice: InvoiceWithRelations,
  options: MapperOptions = {}
): Promise<{
  valid: boolean;
  errors: string[];
  documento?: DocumentoElectronico;
}> {
  try {
    // Validar
    const validation = validateInvoiceForHKA(invoice);
    if (!validation.valid) {
      return {
        valid: false,
        errors: validation.errors,
      };
    }

    // Obtener config y mapear
    const config = await getHKAConfig(clientId);
    const documento = mapInvoiceToHKA(invoice, config, options);

    return {
      valid: true,
      errors: [],
      documento,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Error desconocido'],
    };
  }
}

/**
 * Re-exports del mapper para conveniencia
 */
export {
  mapInvoiceToHKA,
  validateInvoiceForHKA,
  type InvoiceWithRelations,
  type MapperOptions,
};

