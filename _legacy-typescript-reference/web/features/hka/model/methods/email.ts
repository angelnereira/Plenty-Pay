/**
 * HKA Web Service - Métodos EnvioCorreo y RastreoCorreo
 * 
 * Gestiona el envío y seguimiento de facturas por correo electrónico
 * según HKA_Documentacion_Completa.md
 */

import { enviarCorreo, rastrearCorreo } from '../services/hka-soap.service';
import { getHKAConfig } from '../repositories/hka-config.repository';
import type {
  HKAResponse,
  RastreoCorreoResponse,
  RastreoCorreoItem,
  DatosDocumento,
  HKAConfig,
  TipoDocumento,
  TipoEmision,
} from '../types/types';
import { DatosDocumentoSchema, CUFESchema, EnvioCorreoInputSchema } from '../types/types';
import { isValidEmail, validateCUFE } from '../services/utils';
import { buildDatosDocumento, type DatosDocumentoInput } from './shared';

/**
 * Entrada para envío de correo
 */
export interface EnviarCorreoInput extends DatosDocumentoInput {
  /** Correo electrónico del destinatario */
  correo: string;
}

/**
 * Resultado de envío de correo
 */
export interface EnviarCorreoResult {
  /** Envío exitoso */
  success: boolean;
  /** Mensaje de confirmación */
  message?: string;
  /** Mensaje de error si falla */
  error?: string;
  /** Código de respuesta HKA */
  code?: string;
}

/**
 * Resultado de rastreo de correos
 */
export interface RastreoCorreoResult {
  /** Consulta exitosa */
  success: boolean;
  /** Lista de correos enviados con su estado */
  envios?: EmailTrackingItem[];
  /** Mensaje de error si falla */
  error?: string;
  /** Código de respuesta HKA */
  code?: string;
}

/**
 * Item individual de tracking de email
 */
export interface EmailTrackingItem {
  /** Dirección de correo del destinatario */
  correo: string;
  /** Fecha y hora de envío */
  fechaEnvio: string;
  /** Estado: delivered, opened, bounced, etc. */
  estado: string;
  /** Estado normalizado */
  estadoNormalizado: 'SENT' | 'DELIVERED' | 'OPENED' | 'BOUNCED' | 'FAILED' | 'UNKNOWN';
  /** ID único del mensaje */
  messageId: string;
}

/**
 * Envía una factura por correo electrónico usando HKA
 * HKA envía el correo, no tu servidor SMTP
 * 
 * @param clientId - ID del cliente
 * @param input - Datos del documento y correo destinatario
 * @returns Resultado del envío
 * 
 * @example
 * const result = await sendInvoiceEmail(clientId, {
 *   numeroDocumentoFiscal: '0000000176',
 *   correo: 'cliente@empresa.com'
 * });
 * 
 * if (result.success) {
 *   console.log('Correo enviado exitosamente');
 * }
 */
export async function sendInvoiceEmail(
  clientId: string,
  input: EnviarCorreoInput
): Promise<EnviarCorreoResult> {
  try {
    // Validar correo electrónico
    if (!isValidEmail(input.correo)) {
      return {
        success: false,
        error: 'Correo electrónico inválido',
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

    // Llamar al servicio HKA
    const response = await enviarCorreo(config, datosDocumento, input.correo);

    // Procesar respuesta
    return processEnvioResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Envía correo usando configuración pre-cargada
 */
export async function sendInvoiceEmailWithConfig(
  config: HKAConfig,
  datosDocumento: DatosDocumento,
  correo: string
): Promise<EnviarCorreoResult> {
  try {
    if (!isValidEmail(correo)) {
      return {
        success: false,
        error: 'Correo electrónico inválido',
      };
    }

    const docValidation = DatosDocumentoSchema.safeParse(datosDocumento);
    if (!docValidation.success) {
      return {
        success: false,
        error: docValidation.error.issues[0]?.message || 'Datos del documento inválidos',
      };
    }

    const response = await enviarCorreo(config, datosDocumento, correo);
    return processEnvioResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Rastrea el estado de los correos enviados para una factura
 * Utiliza el CUFE (66 caracteres) como identificador
 * 
 * @param clientId - ID del cliente
 * @param cufe - CUFE de la factura (66 caracteres exactos)
 * @returns Lista de correos enviados con su estado
 * 
 * @example
 * const result = await trackEmailDelivery(clientId, 
 *   'FE0120000155596713-2-2015-5900012019052800055000155650121566749040'
 * );
 * 
 * if (result.success) {
 *   for (const envio of result.envios || []) {
 *     console.log(`${envio.correo}: ${envio.estado}`);
 *   }
 * }
 */
export async function trackEmailDelivery(
  clientId: string,
  cufe: string
): Promise<RastreoCorreoResult> {
  try {
    // Validar CUFE (66 caracteres)
    if (!validateCUFE(cufe)) {
      return {
        success: false,
        error: 'CUFE inválido. Debe tener exactamente 66 caracteres.',
      };
    }

    // Obtener configuración HKA
    const config = await getHKAConfig(clientId);

    // Llamar al servicio HKA
    const response = await rastrearCorreo(config, cufe);

    // Procesar respuesta
    return processRastreoResponse(response);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Rastrea correos usando configuración pre-cargada
 */
export async function trackEmailDeliveryWithConfig(
  config: HKAConfig,
  cufe: string
): Promise<RastreoCorreoResult> {
  try {
    if (!validateCUFE(cufe)) {
      return {
        success: false,
        error: 'CUFE inválido. Debe tener exactamente 66 caracteres.',
      };
    }

    const response = await rastrearCorreo(config, cufe);
    return processRastreoResponse(response);
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
 * Procesa la respuesta de envío de correo
 */
function processEnvioResponse(
  response: HKAResponse<void>
): EnviarCorreoResult {
  if (!response.success) {
    return {
      success: false,
      error: response.message || 'Error al enviar correo vía HKA',
      code: response.code,
    };
  }

  return {
    success: true,
    message: response.message || 'Correo enviado exitosamente',
    code: response.code,
  };
}

/**
 * Procesa la respuesta de rastreo de correos
 */
function processRastreoResponse(
  response: HKAResponse<RastreoCorreoResponse>
): RastreoCorreoResult {
  if (!response.success) {
    return {
      success: false,
      error: response.message || 'Error al rastrear correos en HKA',
      code: response.code,
    };
  }

  if (!response.data?.listaRastreo) {
    return {
      success: true,
      envios: [],
      code: response.code,
    };
  }

  // Transformar items de HKA a formato interno
  const envios = response.data.listaRastreo.map(transformTrackingItem);

  return {
    success: true,
    envios,
    code: response.code,
  };
}

/**
 * Transforma un item de rastreo HKA al formato interno
 */
function transformTrackingItem(item: RastreoCorreoItem): EmailTrackingItem {
  return {
    correo: item.correo,
    fechaEnvio: item.creado_en,
    estado: item.estado,
    estadoNormalizado: normalizeEmailStatus(item.estado),
    messageId: item.messageId,
  };
}

/**
 * Normaliza el estado de email de HKA
 */
function normalizeEmailStatus(
  statusHKA: string
): 'SENT' | 'DELIVERED' | 'OPENED' | 'BOUNCED' | 'FAILED' | 'UNKNOWN' {
  const statusLower = (statusHKA || '').toLowerCase();

  if (statusLower === 'delivered' || statusLower.includes('entregado')) {
    return 'DELIVERED';
  }
  if (statusLower === 'opened' || statusLower.includes('abierto') || statusLower.includes('leido')) {
    return 'OPENED';
  }
  if (statusLower === 'bounced' || statusLower.includes('rebotado') || statusLower.includes('rechazado')) {
    return 'BOUNCED';
  }
  if (statusLower === 'failed' || statusLower.includes('fallido') || statusLower.includes('error')) {
    return 'FAILED';
  }
  if (statusLower === 'sent' || statusLower.includes('enviado')) {
    return 'SENT';
  }

  return 'UNKNOWN';
}

/**
 * Envía factura a múltiples correos
 * 
 * @param clientId - ID del cliente
 * @param numeroDocumentoFiscal - Número del documento
 * @param correos - Lista de correos destinatarios
 * @returns Resultados de cada envío
 */
export async function sendInvoiceToMultipleEmails(
  clientId: string,
  numeroDocumentoFiscal: string,
  correos: string[]
): Promise<{ correo: string; result: EnviarCorreoResult }[]> {
  const config = await getHKAConfig(clientId);
  const datosDocumento = buildDatosDocumento(
    { numeroDocumentoFiscal },
    config
  );

  const results: { correo: string; result: EnviarCorreoResult }[] = [];

  for (const correo of correos) {
    const result = await sendInvoiceEmailWithConfig(config, datosDocumento, correo);
    results.push({ correo, result });

    // Pequeña pausa entre envíos
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}

/**
 * Verifica si un correo fue entregado exitosamente
 * 
 * @param envios - Lista de envíos de trackEmailDelivery
 * @param correo - Correo a verificar
 * @returns true si fue entregado o abierto
 */
export function wasEmailDelivered(
  envios: EmailTrackingItem[],
  correo: string
): boolean {
  const envio = envios.find(e => e.correo.toLowerCase() === correo.toLowerCase());
  return envio?.estadoNormalizado === 'DELIVERED' || envio?.estadoNormalizado === 'OPENED';
}

