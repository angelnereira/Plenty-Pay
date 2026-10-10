/**
 * HKA Web Service - Método EstadoDocumento
 * 
 * Consulta el estado actual de un documento previamente enviado
 * según HKA_Documentacion_Completa.md
 */

import { consultarEstadoDocumento } from '../services/hka-soap.service';
import { getHKAConfig } from '../repositories/hka-config.repository';
import type {
  HKAResponse,
  EstadoDocumentoResponse,
  DatosDocumento,
  HKAConfig,
  TipoDocumento,
  TipoEmision,
} from '../types/types';
import { DatosDocumentoSchema } from '../types/types';
import { buildDatosDocumento, type DatosDocumentoInput } from './shared';

/**
 * Entrada para consultar estado de documento
 */
export interface ConsultarEstadoInput extends DatosDocumentoInput { }

/**
 * Resultado de la consulta de estado
 */
export interface EstadoDocumentoResult {
  /** Consulta exitosa */
  success: boolean;
  /** Estado del documento: Autorizada, Pendiente, Rechazada, Anulada */
  estatusDocumento?: string;
  /** Estado normalizado para uso interno */
  status?: 'AUTHORIZED' | 'PENDING' | 'REJECTED' | 'CANCELLED' | 'UNKNOWN';
  /** CUFE del documento */
  cufe?: string;
  /** Fecha de emisión del documento */
  fechaEmisionDocumento?: string;
  /** Fecha de recepción por HKA */
  fechaRecepcionDocumento?: string;
  /** Mensaje adicional sobre el estado */
  mensajeDocumento?: string;
  /** Mensaje de error si falla */
  error?: string;
  /** Código de respuesta HKA */
  code?: string;
}

/**
 * Consulta el estado de un documento en HKA/DGI
 * 
 * @param clientId - ID del cliente para obtener credenciales
 * @param input - Datos del documento a consultar
 * @returns Estado actual del documento
 * 
 * @example
 * const result = await consultarEstado(clientId, {
 *   numeroDocumentoFiscal: '0000000176'
 * });
 * 
 * if (result.success) {
 *   console.log(`Estado: ${result.estatusDocumento}`);
 *   console.log(`CUFE: ${result.cufe}`);
 * }
 */
export async function consultarEstado(
  clientId: string,
  input: ConsultarEstadoInput
): Promise<EstadoDocumentoResult> {
  try {
    // Obtener configuración HKA
    const config = await getHKAConfig(clientId);

    // Construir DatosDocumento
    const datosDocumento = buildDatosDocumento(input, config);

    // Validar con Zod
    const validation = DatosDocumentoSchema.safeParse(datosDocumento);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Datos del documento inválidos',
      };
    }

    // Llamar al servicio HKA
    const response = await consultarEstadoDocumento(config, datosDocumento);

    // Procesar respuesta
    return processEstadoResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Consulta estado usando configuración pre-cargada
 * 
 * @param config - Configuración HKA
 * @param datosDocumento - Datos del documento ya construidos
 */
export async function consultarEstadoWithConfig(
  config: HKAConfig,
  datosDocumento: DatosDocumento
): Promise<EstadoDocumentoResult> {
  try {
    // Validar
    const validation = DatosDocumentoSchema.safeParse(datosDocumento);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0]?.message || 'Datos del documento inválidos',
      };
    }

    const response = await consultarEstadoDocumento(config, datosDocumento);
    return processEstadoResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Construye el objeto DatosDocumento con valores por defecto de la configuración
 */
// buildDatosDocumento imported from './shared'

/**
 * Procesa la respuesta de HKA
 */
function processEstadoResponse(
  response: HKAResponse<EstadoDocumentoResponse>
): EstadoDocumentoResult {
  if (!response.success) {
    return {
      success: false,
      error: response.message || 'Error al consultar estado en HKA',
      code: response.code,
    };
  }

  if (!response.data) {
    return {
      success: false,
      error: 'Sin datos en la respuesta de HKA',
      code: response.code,
    };
  }

  const {
    estatusDocumento,
    cufe,
    fechaEmisionDocumento,
    fechaRecepcionDocumento,
    mensajeDocumento,
  } = response.data;

  // Normalizar estado para uso interno
  const status = normalizeStatus(estatusDocumento);

  return {
    success: true,
    estatusDocumento,
    status,
    cufe,
    fechaEmisionDocumento,
    fechaRecepcionDocumento,
    mensajeDocumento,
    code: response.code,
  };
}

/**
 * Normaliza el estado de HKA a un enum interno
 */
function normalizeStatus(
  estatusHKA: string
): 'AUTHORIZED' | 'PENDING' | 'REJECTED' | 'CANCELLED' | 'UNKNOWN' {
  const statusLower = (estatusHKA || '').toLowerCase();

  if (statusLower.includes('autorizada') || statusLower.includes('authorized')) {
    return 'AUTHORIZED';
  }
  if (statusLower.includes('pendiente') || statusLower.includes('pending')) {
    return 'PENDING';
  }
  if (statusLower.includes('rechazada') || statusLower.includes('rejected')) {
    return 'REJECTED';
  }
  if (statusLower.includes('anulada') || statusLower.includes('cancelled')) {
    return 'CANCELLED';
  }

  return 'UNKNOWN';
}

/**
 * Mapea el estado HKA al InvoiceStatus de Prisma
 */
export function mapHKAStatusToPrisma(
  hkaStatus: string
): 'EMITTED' | 'REJECTED' | 'CANCELLED' | 'PROCESSING' | 'ERROR' {
  const normalized = normalizeStatus(hkaStatus);

  switch (normalized) {
    case 'AUTHORIZED':
      return 'EMITTED';
    case 'REJECTED':
      return 'REJECTED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'PENDING':
      return 'PROCESSING';
    default:
      return 'ERROR';
  }
}

/**
 * Consulta estados de múltiples documentos en lote
 * 
 * @param clientId - ID del cliente
 * @param documentos - Array de números de documento a consultar
 * @returns Array de resultados
 */
export async function consultarEstadosBatch(
  clientId: string,
  documentos: ConsultarEstadoInput[]
): Promise<EstadoDocumentoResult[]> {
  // Obtener configuración una sola vez
  const config = await getHKAConfig(clientId);

  const results: EstadoDocumentoResult[] = [];

  for (const doc of documentos) {
    const datosDocumento = buildDatosDocumento(doc, config);
    const result = await consultarEstadoWithConfig(config, datosDocumento);
    results.push(result);

    // Pequeña pausa entre llamadas
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

/**
 * Verifica si un documento está autorizado
 * 
 * @param clientId - ID del cliente
 * @param numeroDocumentoFiscal - Número del documento
 * @returns true si está autorizado
 */
export async function isDocumentAuthorized(
  clientId: string,
  numeroDocumentoFiscal: string
): Promise<boolean> {
  const result = await consultarEstado(clientId, { numeroDocumentoFiscal });
  return result.success && result.status === 'AUTHORIZED';
}

/**
 * Obtiene el CUFE de un documento si está autorizado
 * 
 * @param clientId - ID del cliente
 * @param numeroDocumentoFiscal - Número del documento
 * @returns CUFE o null si no está disponible
 */
export async function getCUFE(
  clientId: string,
  numeroDocumentoFiscal: string
): Promise<string | null> {
  const result = await consultarEstado(clientId, { numeroDocumentoFiscal });
  return result.success && result.cufe ? result.cufe : null;
}

