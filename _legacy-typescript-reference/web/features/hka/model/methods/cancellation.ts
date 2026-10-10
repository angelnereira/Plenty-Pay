/**
 * HKA Web Service - Método AnulacionDocumento
 * 
 * Gestiona la anulación de facturas emitidas ante la DGI
 * según HKA_Documentacion_Completa.md
 */

import { anularDocumento } from '../services/hka-soap.service';
import { getHKAConfig } from '../repositories/hka-config.repository';
import type {
  HKAResponse,
  DatosDocumento,
  HKAConfig,
  TipoDocumento,
  TipoEmision,
} from '../types/types';
import { DatosDocumentoSchema, AnulacionInputSchema } from '../types/types';
import { truncateString } from '../services/utils';
import { buildDatosDocumento, type DatosDocumentoInput } from './shared';

/**
 * Entrada para anulación de documento
 */
export interface AnularDocumentoInput extends DatosDocumentoInput {
  /** Motivo de la anulación (15-250 caracteres) */
  motivoAnulacion: string;
}

/**
 * Resultado de anulación de documento
 */
export interface AnularDocumentoResult {
  /** Anulación exitosa */
  success: boolean;
  /** Mensaje de confirmación */
  message?: string;
  /** Mensaje de error si falla */
  error?: string;
  /** Código de respuesta HKA */
  code?: string;
}

/** Longitud mínima del motivo de anulación */
const MIN_MOTIVO_LENGTH = 15;
/** Longitud máxima del motivo de anulación */
const MAX_MOTIVO_LENGTH = 250;

/**
 * Anula una factura emitida ante la DGI
 * Esta acción es IRREVERSIBLE
 * 
 * @param clientId - ID del cliente
 * @param input - Datos del documento y motivo de anulación
 * @returns Resultado de la anulación
 * 
 * @example
 * const result = await cancelInvoiceInHKA(clientId, {
 *   numeroDocumentoFiscal: '0000000176',
 *   motivoAnulacion: 'Cliente canceló la compra antes de la entrega del producto'
 * });
 * 
 * if (result.success) {
 *   // Actualizar estado en base de datos local
 *   await updateInvoiceStatus(invoiceId, 'CANCELLED');
 * }
 */
export async function cancelInvoiceInHKA(
  clientId: string,
  input: AnularDocumentoInput
): Promise<AnularDocumentoResult> {
  try {
    // Validar motivo de anulación
    const motivoValidation = validateMotivo(input.motivoAnulacion);
    if (!motivoValidation.valid) {
      return {
        success: false,
        error: motivoValidation.error,
      };
    }

    // Obtener configuración HKA
    const config = await getHKAConfig(clientId);

    // Construir DatosDocumento
    const datosDocumento = buildDatosDocumento(input, config);

    // Validar datos del documento
    const docValidation = DatosDocumentoSchema.safeParse(datosDocumento);
    if (!docValidation.success) {
      return {
        success: false,
        error: docValidation.error.issues[0]?.message || 'Datos del documento inválidos',
      };
    }

    // Formatear motivo (asegurar longitud correcta)
    const motivoFormateado = formatMotivo(input.motivoAnulacion);

    // Llamar al servicio HKA
    const response = await anularDocumento(config, datosDocumento, motivoFormateado);

    // Procesar respuesta
    return processAnulacionResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Anula documento usando configuración pre-cargada
 */
export async function cancelInvoiceWithConfig(
  config: HKAConfig,
  datosDocumento: DatosDocumento,
  motivoAnulacion: string
): Promise<AnularDocumentoResult> {
  try {
    // Validar motivo
    const motivoValidation = validateMotivo(motivoAnulacion);
    if (!motivoValidation.valid) {
      return {
        success: false,
        error: motivoValidation.error,
      };
    }

    // Validar datos del documento
    const docValidation = DatosDocumentoSchema.safeParse(datosDocumento);
    if (!docValidation.success) {
      return {
        success: false,
        error: docValidation.error.issues[0]?.message || 'Datos del documento inválidos',
      };
    }

    const motivoFormateado = formatMotivo(motivoAnulacion);
    const response = await anularDocumento(config, datosDocumento, motivoFormateado);
    return processAnulacionResponse(response);
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
 * Valida el motivo de anulación
 */
function validateMotivo(motivo: string): { valid: boolean; error?: string } {
  if (!motivo || motivo.trim().length === 0) {
    return {
      valid: false,
      error: 'El motivo de anulación es requerido',
    };
  }

  const trimmed = motivo.trim();

  if (trimmed.length < MIN_MOTIVO_LENGTH) {
    return {
      valid: false,
      error: `El motivo debe tener al menos ${MIN_MOTIVO_LENGTH} caracteres`,
    };
  }

  if (trimmed.length > MAX_MOTIVO_LENGTH) {
    return {
      valid: false,
      error: `El motivo no puede exceder ${MAX_MOTIVO_LENGTH} caracteres`,
    };
  }

  return { valid: true };
}

/**
 * Formatea el motivo de anulación
 */
function formatMotivo(motivo: string): string {
  let formatted = motivo.trim();

  // Si es muy largo, truncar
  if (formatted.length > MAX_MOTIVO_LENGTH) {
    formatted = truncateString(formatted, MAX_MOTIVO_LENGTH);
  }

  // Si es muy corto, esto ya fue validado antes, pero por seguridad:
  if (formatted.length < MIN_MOTIVO_LENGTH) {
    formatted = formatted.padEnd(MIN_MOTIVO_LENGTH, '.');
  }

  return formatted;
}

/**
 * Procesa la respuesta de anulación
 */
function processAnulacionResponse(
  response: HKAResponse<void>
): AnularDocumentoResult {
  if (!response.success) {
    return {
      success: false,
      error: response.message || 'Error al anular documento en HKA',
      code: response.code,
    };
  }

  return {
    success: true,
    message: response.message || 'Documento anulado exitosamente',
    code: response.code,
  };
}

/**
 * Motivos de anulación comunes pre-definidos
 */
export const MOTIVOS_ANULACION_COMUNES = [
  'Error en los datos del cliente (RUC, nombre o dirección incorrectos)',
  'Error en los montos o cálculos de la factura',
  'Error en los productos o servicios facturados',
  'Cliente canceló la compra antes de la entrega del producto',
  'Factura emitida por error o duplicada',
  'Cambio en las condiciones de venta acordadas',
  'Devolución total de los productos facturados',
  'Error en la fecha de emisión del documento',
  'Factura emitida al cliente incorrecto',
  'Anulación solicitada por el cliente',
] as const;

/**
 * Verifica si un documento puede ser anulado
 * (debe estar en estado EMITTED y no haber sido anulado previamente)
 * 
 * @param status - Estado actual del documento
 * @returns true si puede ser anulado
 */
export function canBeCancelled(status: string): boolean {
  const cancellableStatuses = ['EMITTED', 'CERTIFIED'];
  return cancellableStatuses.includes(status.toUpperCase());
}

/**
 * Genera un motivo de anulación con formato estándar
 * 
 * @param razon - Razón principal
 * @param detalles - Detalles adicionales (opcional)
 * @returns Motivo formateado
 */
export function buildCancellationReason(razon: string, detalles?: string): string {
  let motivo = razon.trim();

  if (detalles && detalles.trim()) {
    motivo += `. Detalles: ${detalles.trim()}`;
  }

  // Asegurar que termina con punto
  if (!motivo.endsWith('.') && !motivo.endsWith('?') && !motivo.endsWith('!')) {
    motivo += '.';
  }

  return formatMotivo(motivo);
}

