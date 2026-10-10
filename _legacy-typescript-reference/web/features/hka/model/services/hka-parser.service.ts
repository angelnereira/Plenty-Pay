/**
 * HKA Web Service - Parser XML de Respuestas
 * 
 * Convierte respuestas XML SOAP de HKA a objetos JSON tipados
 * según HKA_Documentacion_Completa.md
 */

import { HKAError as HKAParserError } from './errors';
import { HKALogger } from './logger';
import { XMLParser } from 'fast-xml-parser';
import type {
  HKAResponse,
  EnviarResponse,
  EstadoDocumentoResponse,
  FoliosRestantesResponse,
  ConsultarRucDVResponse,
  DescargaResponse,
  RastreoCorreoResponse,
  RastreoCorreoItem,
} from '../types/types';
import { HKA_RESPONSE_CODES } from '../types/types';

/**
 * Configuración del parser XML
 * fast-xml-parser requiere configuración específica para manejar namespaces SOAP
 */
const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // Remueve prefijos de namespace (a:codigo -> codigo)
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
  isArray: (name: string) => {
    // Campos que siempre deben ser arrays
    return ['listTracking', 'listaRastreo'].includes(name);
  },
};

const parser = new XMLParser(parserOptions);

/**
 * Extrae el resultado del body SOAP de HKA
 * Las respuestas tienen estructura: Envelope > Body > {Method}Response > {Method}Result
 */
function extractResultFromSOAP(
  parsedXML: Record<string, unknown>,
  methodName: string
): Record<string, unknown> | null {
  try {
    const envelope = parsedXML['Envelope'] as Record<string, unknown>;
    if (!envelope) return null;

    const body = envelope['Body'] as Record<string, unknown>;
    if (!body) return null;

    const response = body[`${methodName}Response`] as Record<string, unknown>;
    if (!response) return null;

    const result = response[`${methodName}Result`] as Record<string, unknown>;
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Parsea una respuesta genérica de HKA
 * Todos los métodos retornan al menos: codigo, resultado, mensaje
 */
export function parseHKAResponse<T = void>(
  xmlResponse: string,
  methodName: string
): HKAResponse<T> {
  try {
    const parserLogger = new HKALogger();
    const parsed = parser.parse(xmlResponse);
    const result = extractResultFromSOAP(parsed, methodName);

    if (!result) {
      // LOG CRÍTICO: Si no podemos extraer el resultado, necesitamos ver qué llegó
      parserLogger.log({
        level: 'ERROR',
        method: 'parseHKAResponse',
        timestamp: new Date(),
        metadata: { action: 'CRITICAL: No se pudo extraer resultado', xmlSample: xmlResponse.substring(0, 200) }
      });
      throw new Error(`Respuesta HKA inválida o vacía. Method: ${methodName}`);
    }

    let codigo = String(result['codigo'] || '');
    let mensaje = String(result['mensaje'] || '');
    const resultado = String(result['resultado'] || '');

    // DETECCIÓN DE ERROR | - |
    // A veces HKA devuelve campos vacíos y al concatenarlos en el frontend o logs se ve como "| - |"
    if (!codigo && !mensaje) {
      parserLogger.log({
        level: 'WARN',
        method: 'parseHKAResponse',
        timestamp: new Date(),
        metadata: { action: 'Respuesta con campos vacíos', xmlSample: xmlResponse.substring(0, 200) }
      });
      codigo = 'UNKNOWN';
      mensaje = 'El servicio de HKA respondió sin código ni mensaje de error. Por favor intente nuevamente.';
    }

    // Limpieza de mensajes "feos" como "| - |" si llegaran a venir así
    if (mensaje.includes('| - |') || (codigo === '' && mensaje === '')) {
      mensaje = 'Error desconocido del proveedor (Sin detalles)';
    }

    const success = codigo === HKA_RESPONSE_CODES.SUCCESS ||
      codigo === HKA_RESPONSE_CODES.DOCUMENT_ERROR;

    if (!success) {
      parserLogger.log({
        level: 'ERROR',
        method: 'parseHKAResponse',
        timestamp: new Date(),
        metadata: { action: `Error response from ${methodName}`, codigo, mensaje, resultado, raw: xmlResponse }
      });
    }

    return {
      success,
      code: codigo,
      message: mensaje,
      resultado,
      data: result as T,
    };
  } catch (error) {
    const parserLogger = new HKALogger();
    parserLogger.log({
      level: 'ERROR',
      method: 'parseHKAResponse',
      timestamp: new Date(),
      metadata: { action: 'EXCEPTION parsing XML', error: String(error), xmlSample: xmlResponse.substring(0, 200) }
    });
    throw new Error(`Error al parsear respuesta XML de HKA: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parsea respuesta del método Enviar
 * Campos esperados: cufe, qr, fechaRecepcionDGI, nroProtocoloAutorizacion
 */
export function parseEnviarResponse(xmlResponse: string): HKAResponse<EnviarResponse> {
  const baseResponse = parseHKAResponse(xmlResponse, 'Enviar');

  if (!baseResponse.success || !baseResponse.data) {
    return baseResponse as HKAResponse<EnviarResponse>;
  }

  const data = baseResponse.data as Record<string, unknown>;

  return {
    ...baseResponse,
    data: {
      cufe: String(data['cufe'] || ''),
      qr: String(data['qr'] || ''),
      fechaRecepcionDGI: String(data['fechaRecepcionDGI'] || ''),
      nroProtocoloAutorizacion: String(data['nroProtocoloAutorizacion'] || ''),
    },
  };
}

/**
 * Parsea respuesta del método EstadoDocumento
 * Campos esperados: estatusDocumento, cufe, fechas, mensajeDocumento
 */
export function parseEstadoDocumentoResponse(xmlResponse: string): HKAResponse<EstadoDocumentoResponse> {
  const baseResponse = parseHKAResponse(xmlResponse, 'EstadoDocumento');

  if (!baseResponse.success || !baseResponse.data) {
    return baseResponse as HKAResponse<EstadoDocumentoResponse>;
  }

  const data = baseResponse.data as Record<string, unknown>;

  return {
    ...baseResponse,
    data: {
      estatusDocumento: String(data['estatusDocumento'] || ''),
      cufe: String(data['cufe'] || ''),
      fechaEmisionDocumento: String(data['fechaEmisionDocumento'] || ''),
      fechaRecepcionDocumento: String(data['fechaRecepcionDocumento'] || ''),
      mensajeDocumento: String(data['mensajeDocumento'] || ''),
    },
  };
}

/**
 * Parsea respuesta del método FoliosRestantes
 * Campos esperados: licencia, fechas, folios disponibles/utilizados
 */
export function parseFoliosRestantesResponse(xmlResponse: string): HKAResponse<FoliosRestantesResponse> {
  const baseResponse = parseHKAResponse(xmlResponse, 'FoliosRestantes');

  if (!baseResponse.success || !baseResponse.data) {
    return baseResponse as HKAResponse<FoliosRestantesResponse>;
  }

  const data = baseResponse.data as Record<string, unknown>;

  return {
    ...baseResponse,
    data: {
      licencia: String(data['licencia'] || ''),
      fechaLicencia: String(data['fechaLicencia'] || ''),
      ciclo: String(data['ciclo'] || ''),
      fechaCiclo: String(data['fechaCiclo'] || ''),
      foliosTotalesCiclo: parseInt(String(data['foliosTotalesCiclo'] || '0'), 10),
      foliosUtilizadosCiclo: parseInt(String(data['foliosUtilizadosCiclo'] || '0'), 10),
      foliosDisponiblesCiclo: parseInt(String(data['foliosDisponiblesCiclo'] || '0'), 10),
      foliosTotales: parseInt(String(data['foliosTotales'] || '0'), 10),
    },
  };
}

/**
 * Parsea respuesta del método ConsultarRucDV
 * La estructura tiene un objeto infoRuc anidado
 */
export function parseConsultarRucDVResponse(xmlResponse: string): HKAResponse<ConsultarRucDVResponse> {
  const baseResponse = parseHKAResponse(xmlResponse, 'ConsultarRucDV');

  if (!baseResponse.success || !baseResponse.data) {
    return baseResponse as HKAResponse<ConsultarRucDVResponse>;
  }

  const data = baseResponse.data as Record<string, unknown>;
  const infoRuc = (data['infoRuc'] || data) as Record<string, unknown>;

  return {
    ...baseResponse,
    data: {
      tipoRuc: String(infoRuc['tipoRuc'] || ''),
      ruc: String(infoRuc['ruc'] || ''),
      dv: String(infoRuc['dv'] || ''),
      razonSocial: String(infoRuc['razonSocial'] || ''),
      afiliadoFE: String(infoRuc['afiliadoFE'] || ''),
    },
  };
}

/**
 * Parsea respuesta de métodos de descarga (DescargaPDF, DescargaXML)
 * Campos esperados: documento (Base64)
 */
export function parseDescargaResponse(
  xmlResponse: string,
  methodName: 'DescargaPDF' | 'DescargaXML'
): HKAResponse<DescargaResponse> {
  const baseResponse = parseHKAResponse(xmlResponse, methodName);

  if (!baseResponse.success || !baseResponse.data) {
    return baseResponse as HKAResponse<DescargaResponse>;
  }

  const data = baseResponse.data as Record<string, unknown>;

  return {
    ...baseResponse,
    data: {
      documento: String(data['documento'] || ''),
    },
  };
}

/**
 * Parsea respuesta del método RastreoCorreo
 * La estructura contiene listaRastreo con array de listTracking
 */
export function parseRastreoCorreoResponse(xmlResponse: string): HKAResponse<RastreoCorreoResponse> {
  const baseResponse = parseHKAResponse(xmlResponse, 'RastreoCorreo');

  if (!baseResponse.success || !baseResponse.data) {
    return baseResponse as HKAResponse<RastreoCorreoResponse>;
  }

  const data = baseResponse.data as Record<string, unknown>;
  const listaRastreo = data['listaRastreo'] as Record<string, unknown> | undefined;

  let items: RastreoCorreoItem[] = [];

  if (listaRastreo) {
    const tracking = listaRastreo['listTracking'];

    if (Array.isArray(tracking)) {
      items = tracking.map((item: Record<string, unknown>) => ({
        correo: String(item['correo'] || ''),
        creado_en: String(item['creado_en'] || ''),
        estado: String(item['estado'] || ''),
        messageId: String(item['messageId'] || ''),
      }));
    } else if (tracking && typeof tracking === 'object') {
      // Si solo hay un elemento, fast-xml-parser puede devolverlo como objeto
      const single = tracking as Record<string, unknown>;
      items = [{
        correo: String(single['correo'] || ''),
        creado_en: String(single['creado_en'] || ''),
        estado: String(single['estado'] || ''),
        messageId: String(single['messageId'] || ''),
      }];
    }
  }

  return {
    ...baseResponse,
    data: {
      listaRastreo: items,
    },
  };
}

/**
 * Parsea respuesta simple (AnulacionDocumento, EnvioCorreo)
 * Solo verifica código de éxito, no extrae datos adicionales
 */
export function parseSimpleResponse(
  xmlResponse: string,
  methodName: string
): HKAResponse<void> {
  return parseHKAResponse<void>(xmlResponse, methodName);
}

/**
 * Decodifica un documento Base64 a Buffer
 * Usado para PDF y XML descargados de HKA
 */
export function decodeBase64Document(base64String: string): Buffer {
  return Buffer.from(base64String, 'base64');
}

/**
 * Convierte un documento Base64 a string (para XML)
 */
export function decodeBase64ToString(base64String: string): string {
  return Buffer.from(base64String, 'base64').toString('utf-8');
}

/**
 * Verifica si una respuesta XML es un error SOAP
 */
export function isSOAPFault(xmlResponse: string): boolean {
  return xmlResponse.includes('Fault') || xmlResponse.includes('fault');
}

/**
 * Extrae mensaje de error de un SOAP Fault
 */
export function extractSOAPFaultMessage(xmlResponse: string): string {
  try {
    const parsed = parser.parse(xmlResponse);
    const envelope = parsed['Envelope'] as Record<string, unknown>;
    if (!envelope) return 'Error desconocido';

    const body = envelope['Body'] as Record<string, unknown>;
    if (!body) return 'Error desconocido';

    const fault = body['Fault'] as Record<string, unknown>;
    if (!fault) return 'Error desconocido';

    const faultString = fault['faultstring'] || fault['Reason'] || '';
    return String(faultString) || 'Error SOAP desconocido';
  } catch {
    return 'Error al parsear SOAP Fault';
  }
}

/**
 * Obtiene descripción legible del código de respuesta HKA
 */
export function getResponseCodeDescription(code: string): string {
  const descriptions: Record<string, string> = {
    '200': 'Operación exitosa',
    '100': 'Sin datos encontrados',
    '101': 'Token de autenticación inválido',
    '102': 'Documento duplicado o no existe',
    '109': 'Error de validación en campos',
    '201': 'Error al procesar la solicitud',
    '202': 'Error de comunicación con la DGI',
    '300': 'El documento debe reenviarse',
  };

  return descriptions[code] || `Código desconocido: ${code}`;
}

