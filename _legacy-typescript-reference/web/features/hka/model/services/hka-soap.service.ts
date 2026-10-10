/**
 * HKA Web Service - Cliente SOAP
 *
 * MIGRADO A CLIENTE SOAP REAL (package 'soap')
 * Anteriormente usaba fetch con XML manual
 *
 * VENTAJAS del cliente SOAP:
 * - Lee WSDL automáticamente del endpoint
 * - Maneja namespaces automáticamente del WSDL
 * - Compatible con forma oficial de HKA
 * - Menos propenso a errores de formato XML
 * - Similar a ejemplos de documentación (PHP SoapClient, C# ServiceClient)
 */

import type { HKAConfig, HKAResponse } from '../types/types';
import { HKA_ENDPOINTS } from '../types/types';
import { HKALogger } from './logger';
import { HKAError, HKAErrorType, parseHKAError, createHKAErrorFromCode } from './errors';
import { getHKASoapClient, callSoapMethod } from './hka-soap-client.service';
import { buildEnviarXML } from './hka-xml.service';
import { parseEnviarResponse, isSOAPFault, extractSOAPFaultMessage } from './hka-parser.service';
import type {
  DatosDocumento,
  DocumentoElectronico,
  EnviarResponse,
  EstadoDocumentoResponse,
  FoliosRestantesResponse,
  ConsultarRucDVResponse,
  DescargaResponse,
  RastreoCorreoResponse,
} from '../types/types';

/** Instancia global del logger */
const logger = new HKALogger();

/**
 * Procesa respuesta genérica de HKA
 * Convierte respuesta SOAP a HKAResponse normalizado
 *
 * Manejo de códigos HKA:
 * - 200: Éxito → success=true
 * - 201: Error interno HKA → THROW HKAError (recuperable, triggers retry)
 * - 202: DGI Timeout → THROW HKAError (NO recuperable, triggers polling flow)
 * - 102: Error XSD/documento → success=false (NO es "duplicate")
 * - 300: Reenvío requerido → THROW HKAError (recuperable, triggers retry)
 * - Otros: success=false
 */
function processHKAResponse<T>(
  rawResponse: any,
  resultKey: string
): HKAResponse<T> {
  try {
    // La respuesta SOAP viene anidada en {MethodNameResponse: {MethodNameResult: {...}}}
    const resultData = rawResponse[resultKey];

    if (!resultData) {
      return {
        success: false,
        code: 'PARSE_ERROR',
        message: `No se encontró clave ${resultKey} en respuesta`,
      };
    }

    // Extraer código y mensaje (HKA devuelve PascalCase o camelCase inconsistentemente)
    const codigo = String(resultData.codigo || resultData.Codigo || 'UNKNOWN');
    const resultado = resultData.resultado || resultData.Resultado || '';
    const mensaje = resultData.mensaje || resultData.Mensaje || '';

    // =====================================================
    // CÓDIGOS QUE REQUIEREN THROW (para retry o polling)
    // =====================================================

    // Código 201: Error interno HKA — RECUPERABLE, se lanza para trigger retry
    if (codigo === '201') {
      logger.log({
        level: 'WARN',
        method: 'processHKAResponse',
        timestamp: new Date(),
        metadata: { codigo, mensaje, action: 'THROW_FOR_RETRY' },
      });
      throw createHKAErrorFromCode('201', mensaje);
    }

    // Código 202: DGI Timeout — CRÍTICO, NO reintentar Enviar()
    // El documento ya está en cola de HKA, usar EstadoDocumento() para polling
    if (codigo === '202') {
      logger.log({
        level: 'ERROR',
        method: 'processHKAResponse',
        timestamp: new Date(),
        metadata: { codigo, mensaje, action: 'DGI_TIMEOUT_NO_RETRY' },
      });
      throw createHKAErrorFromCode('202', mensaje);
    }

    // Código 300: Reenvío requerido — RECUPERABLE
    if (codigo === '300') {
      logger.log({
        level: 'WARN',
        method: 'processHKAResponse',
        timestamp: new Date(),
        metadata: { codigo, mensaje, action: 'THROW_FOR_RESEND' },
      });
      throw createHKAErrorFromCode('300', mensaje);
    }

    // Código 102: Error XSD/Documento — ERROR DE VALIDACIÓN
    // No es éxito, no es duplicado. Indicar error de datos.
    if (codigo === '102') {
      logger.log({
        level: 'ERROR',
        method: 'processHKAResponse',
        timestamp: new Date(),
        metadata: { codigo, mensaje, action: 'THROW_VALIDATION_ERROR' },
      });
      throw createHKAErrorFromCode('102', mensaje);
    }

    // =====================================================
    // CÓDIGOS DE ÉXITO / ERROR SIMPLE
    // =====================================================

    // Solo código 200 es éxito definitivo
    const success = codigo === '200' || resultado.toLowerCase() === 'procesado';

    return {
      success,
      code: codigo,
      message: mensaje,
      data: success ? resultData : undefined,
    };
  } catch (error) {
    // Si el error ya es un HKAError (lanzado intencionalmente arriba), re-lanzarlo
    // para que el consumidor pueda manejar retries, polling, etc.
    if (error instanceof HKAError) {
      throw error;
    }

    logger.log({
      level: 'ERROR',
      method: 'processHKAResponse',
      timestamp: new Date(),
      error: {
        type: 'RESPONSE_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      metadata: {
        resultKey,
        rawResponse: JSON.stringify(rawResponse).substring(0, 500),
      }
    });

    return {
      success: false,
      code: 'PARSE_ERROR',
      message: `Error procesando respuesta: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    };
  }
}

// ============================================
// MÉTODOS PÚBLICOS DE LA API
// ============================================

/**
 * Método Enviar - Crear y enviar una factura electrónica
 *
 * CRITICAL FIX: Usa XML manual (buildEnviarXML) en vez de node-soap auto-serialización.
 * node-soap se basa en el WSDL para serializar, y si el WSDL no define campos como
 * codigoCPBS, codigoCPBSAbrev, unidadMedidaCPBS (obligatorios para gobierno),
 * los omite silenciosamente, causando error 102 de HKA.
 *
 * El XML builder manual incluye TODOS los campos definidos en nuestros tipos.
 */
export async function enviarFactura(
  config: HKAConfig,
  documento: DocumentoElectronico
): Promise<HKAResponse<EnviarResponse>> {
  try {
    logger.log({
      level: 'INFO',
      method: 'enviarFactura',
      timestamp: new Date(),
      metadata: {
        hasTokenEmpresa: !!config.tokenEmpresa,
        hasTokenPassword: !!config.tokenPassword,
        environment: config.environment,
        action: 'Iniciando envío a HKA (XML manual)'
      }
    });

    // Validar que listaItems existe y no está vacío
    if (!documento.listaItems || !Array.isArray(documento.listaItems) || documento.listaItems.length === 0) {
      logger.log({
        level: 'WARN',
        method: 'enviarFactura',
        timestamp: new Date(),
        metadata: {
          hasListaItems: !!documento.listaItems,
          isArray: Array.isArray(documento.listaItems),
          length: documento.listaItems?.length,
          warning: 'listaItems is missing or empty'
        }
      });
    }

    // Log CPBS fields for government invoice debugging
    if (documento.datosTransaccion?.cliente?.tipoClienteFE === '03') {
      logger.log({
        level: 'DEBUG',
        method: 'enviarFactura',
        timestamp: new Date(),
        metadata: {
          action: 'Gobierno invoice - CPBS check',
          items: documento.listaItems.map((item, i) => ({
            idx: i,
            codigoCPBS: item.codigoCPBS,
            codigoCPBSAbrev: item.codigoCPBSAbrev,
            unidadMedidaCPBS: item.unidadMedidaCPBS,
          })),
        }
      });
    }

    // PRE-FLIGHT: verify CUFE[0:2] matches datosTransaccion.tipoDocumento before sending.
    // This catches mismatches locally instead of receiving a cryptic HKA error 109/tipoDocumento.
    const _contingenciaCufe = (documento as unknown as Record<string, unknown>).contingenciaCufe as string | undefined;
    const _tipoDocXml = documento.datosTransaccion?.tipoDocumento as string | undefined;
    if (_contingenciaCufe && _tipoDocXml) {
      const _cufeDoc = _contingenciaCufe.slice(0, 2);
      if (_cufeDoc !== _tipoDocXml) {
        throw new HKAError(
          HKAErrorType.VALIDATION,
          `[PRE-FLIGHT] CUFE tipoDocumento mismatch: CUFE[0:2]="${_cufeDoc}" vs datosTransaccion.tipoDocumento="${_tipoDocXml}". ` +
          `cufe_full="${_contingenciaCufe}" cadena_len=${_contingenciaCufe.length}`,
          { metadata: { cufeDoc: _cufeDoc, xmlDoc: _tipoDocXml, cufe: _contingenciaCufe } }
        );
      }
    }

    // Build SOAP XML manually to ensure ALL fields are included (especially CPBS for gobierno)
    const soapXML = buildEnviarXML(
      config.tokenEmpresa,
      config.tokenPassword,
      documento
    );

    // Validar tamaño máximo permitido por HKA: 1,000 KB (1,024,000 bytes)
    const MAX_SOAP_BYTES = 1_024_000;
    const soapBytes = Buffer.byteLength(soapXML, 'utf8');
    if (soapBytes > MAX_SOAP_BYTES) {
      throw new HKAError(
        HKAErrorType.VALIDATION,
        `El mensaje SOAP excede el límite de 1,000 KB permitido por HKA (${Math.round(soapBytes / 1024)} KB). ` +
        `Reduzca la cantidad de ítems o el tamaño de los campos de texto.`,
        { metadata: { soapBytes, maxBytes: MAX_SOAP_BYTES } }
      );
    }

    // Extract CUFE and tipoDocumento for targeted diagnostic log
    const _cufeInXml = soapXML.match(/<ser:cufe>(.*?)<\/ser:cufe>/)?.[1];
    const _tipoDocInXml = soapXML.match(/<ser:tipoDocumento>(.*?)<\/ser:tipoDocumento>/)?.[1];
    const _tipoEmisionInXml = soapXML.match(/<tem:tipoEmision>(.*?)<\/tem:tipoEmision>/)?.[1];
    logger.log({
      level: 'INFO',
      method: 'enviarFactura',
      timestamp: new Date(),
      metadata: {
        action: 'SOAP_PAYLOAD_SUMMARY',
        tipoEmision: _tipoEmisionInXml,
        tipoDocumento: _tipoDocInXml,
        cufe: _cufeInXml,
        cufeLen: _cufeInXml?.length,
        cufe_tipoDoc: _cufeInXml?.slice(0, 2),
        cufe_tipoContrib: _cufeInXml?.slice(2, 3),
        cufe_ruc: _cufeInXml?.slice(3, 23),
        cufe_dv: _cufeInXml?.slice(23, 26),
        cufe_tipoEmision: _cufeInXml?.slice(51, 53),
        cufe_ambiente: _cufeInXml?.slice(53, 54),
        xmlLength: soapXML.length,
      }
    });

    // Send via fetch to HKA SOAP endpoint (bypasses node-soap WSDL filtering)
    const endpoint = HKA_ENDPOINTS[config.environment];
    const soapAction = '"http://tempuri.org/IService/Enviar"';

    const fetchResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': soapAction,
        'Accept': '*/*',
      },
      body: soapXML,
      signal: AbortSignal.timeout(30000),
    });

    const responseXML = await fetchResponse.text();

    logger.log({
      level: 'DEBUG',
      method: 'enviarFactura',
      timestamp: new Date(),
      metadata: {
        action: 'XML Response received',
        httpStatus: fetchResponse.status,
        xmlResponsePreview: responseXML.substring(0, 2000),
      }
    });

    // Check for SOAP faults (HTTP 500 from HKA)
    if (!fetchResponse.ok) {
      if (isSOAPFault(responseXML)) {
        const faultMsg = extractSOAPFaultMessage(responseXML);
        throw new HKAError(HKAErrorType.NETWORK, `HKA SOAP Fault: ${faultMsg}`);
      }
      throw new HKAError(
        HKAErrorType.NETWORK,
        `HKA HTTP ${fetchResponse.status}: ${responseXML.substring(0, 200)}`
      );
    }

    // Parse using the robust fast-xml-parser based parser (same as other methods use)
    const response = parseEnviarResponse(responseXML);

    // CRITICAL: Re-throw HKA error codes that the orchestrator expects for retry/polling
    // processHKAResponse used to throw for codes 102, 201, 202, 300 — preserve that behavior
    if (response.code === '201') {
      throw createHKAErrorFromCode('201', response.message);
    }
    if (response.code === '202') {
      throw createHKAErrorFromCode('202', response.message);
    }
    if (response.code === '300') {
      throw createHKAErrorFromCode('300', response.message);
    }
    if (response.code === '102') {
      throw createHKAErrorFromCode('102', response.message);
    }

    logger.log({
      level: response.success ? 'INFO' : 'WARN',
      method: 'enviarFactura',
      timestamp: new Date(),
      metadata: {
        success: response.success,
        code: response.code,
        message: response.message,
        action: 'Procesado'
      }
    });

    return response;
  } catch (error) {
    logger.log({
      level: 'ERROR',
      method: 'enviarFactura',
      timestamp: new Date(),
      error: {
        type: 'SOAP_CALL_ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    // Re-throw HKAErrors so the orchestrator can handle retries/polling
    if (error instanceof HKAError) {
      throw error;
    }

    const hkaError = parseHKAError(undefined, error instanceof Error ? error.message : 'Error desconocido');

    return {
      success: false,
      code: hkaError.code || 'CLIENT_ERROR',
      message: hkaError.toUserMessage(),
    };
  }
}

/**
 * Método EstadoDocumento - Consultar estado de un documento
 */
export async function consultarEstadoDocumento(
  config: HKAConfig,
  datosDocumento: DatosDocumento
): Promise<HKAResponse<EstadoDocumentoResponse>> {
  try {
    const client = await getHKASoapClient(config);

    const args = {
      tokenEmpresa: config.tokenEmpresa,
      tokenPassword: config.tokenPassword,
      datosDocumento: {
        codigoSucursalEmisor: datosDocumento.codigoSucursalEmisor,
        numeroDocumentoFiscal: datosDocumento.numeroDocumentoFiscal,
        puntoFacturacionFiscal: datosDocumento.puntoFacturacionFiscal,
        tipoDocumento: datosDocumento.tipoDocumento,
        tipoEmision: datosDocumento.tipoEmision,
      },
    };

    logger.log({
      level: 'INFO',
      method: 'EstadoDocumento',
      timestamp: new Date(),
      metadata: { action: 'Calling SOAP', datosDocumento }
    });
    const rawResponse = await callSoapMethod(client, 'EstadoDocumento', args);
    const response = processHKAResponse<EstadoDocumentoResponse>(rawResponse, 'EstadoDocumentoResult');
    logger.log({
      level: response.success ? 'INFO' : 'WARN',
      method: 'EstadoDocumento',
      timestamp: new Date(),
      metadata: { success: response.success, code: response.code, message: response.message }
    });

    // Mapear campos específicos
    // FIX: Castear a any por PascalCase/camelCase inconsistente
    const responseData = response.data as any;
    if (response.success && responseData) {
      response.data = {
        estatusDocumento: responseData.estatusDocumento || responseData.EstatusDocumento || '',
        cufe: responseData.cufe || responseData.Cufe || '',
        fechaEmisionDocumento: responseData.fechaEmisionDocumento || responseData.FechaEmisionDocumento || '',
        fechaRecepcionDocumento: responseData.fechaRecepcionDocumento || responseData.FechaRecepcionDocumento || '',
        mensajeDocumento: responseData.mensajeDocumento || responseData.MensajeDocumento || '',
      } as EstadoDocumentoResponse;
    }

    return response;
  } catch (error) {
    const hkaError = error instanceof HKAError
      ? error
      : parseHKAError(undefined, error instanceof Error ? error.message : 'Error desconocido');

    return {
      success: false,
      code: hkaError.code || 'CLIENT_ERROR',
      message: hkaError.toUserMessage(),
    };
  }
}

/**
 * Método FoliosRestantes - Consultar folios disponibles
 * El método más simple - solo requiere tokens
 */
export async function consultarFoliosRestantes(
  config: HKAConfig
): Promise<HKAResponse<FoliosRestantesResponse>> {
  try {
    const client = await getHKASoapClient(config);

    const args = {
      tokenEmpresa: config.tokenEmpresa,
      tokenPassword: config.tokenPassword,
    };

    logger.log({
      level: 'INFO',
      method: 'FoliosRestantes',
      timestamp: new Date(),
      metadata: { action: 'Calling SOAP' }
    });
    const rawResponse = await callSoapMethod(client, 'FoliosRestantes', args);
    const response = processHKAResponse<FoliosRestantesResponse>(rawResponse, 'FoliosRestantesResult');
    logger.log({
      level: response.success ? 'INFO' : 'WARN',
      method: 'FoliosRestantes',
      timestamp: new Date(),
      metadata: { success: response.success, code: response.code, message: response.message }
    });

    // Mapear campos específicos
    // FIX: Castear a any por PascalCase/camelCase inconsistente
    const responseData = response.data as any;
    if (response.success && responseData) {
      response.data = {
        licencia: responseData.licencia || responseData.Licencia || '',
        fechaLicencia: responseData.fechaLicencia || responseData.FechaLicencia || '',
        ciclo: responseData.ciclo || responseData.Ciclo || '',
        fechaCiclo: responseData.fechaCiclo || responseData.FechaCiclo || '',
        foliosTotalesCiclo: Number(responseData.foliosTotalesCiclo || responseData.FoliosTotalesCiclo || 0),
        foliosUtilizadosCiclo: Number(responseData.foliosUtilizadosCiclo || responseData.FoliosUtilizadosCiclo || 0),
        foliosDisponiblesCiclo: Number(responseData.foliosDisponiblesCiclo || responseData.FoliosDisponiblesCiclo || 0),
        foliosTotales: Number(responseData.foliosTotales || responseData.FoliosTotales || 0),
      } as FoliosRestantesResponse;
    }

    return response;
  } catch (error) {
    const hkaError = error instanceof HKAError
      ? error
      : parseHKAError(undefined, error instanceof Error ? error.message : 'Error desconocido');

    return {
      success: false,
      code: hkaError.code || 'CLIENT_ERROR',
      message: hkaError.toUserMessage(),
    };
  }
}

/**
 * Método ConsultarRucDV - Validar RUC y obtener dígito verificador
 */
export async function consultarRucDV(
  config: HKAConfig,
  tipoRuc: '1' | '2',
  ruc: string
): Promise<HKAResponse<ConsultarRucDVResponse>> {
  try {
    const client = await getHKASoapClient(config);

    const args = {
      consultarRucDVRequest: {
        tokenEmpresa: config.tokenEmpresa,
        tokenPassword: config.tokenPassword,
        tipoRuc: tipoRuc,
        ruc: ruc,
      }
    };

    logger.log({
      level: 'INFO',
      method: 'ConsultarRucDV',
      timestamp: new Date(),
      metadata: { action: 'Calling SOAP', tipoRuc, ruc }
    });
    const rawResponse = await callSoapMethod(client, 'ConsultarRucDV', args);
    const response = processHKAResponse<ConsultarRucDVResponse>(rawResponse, 'ConsultarRucDVResult');
    logger.log({
      level: response.success ? 'INFO' : 'WARN',
      method: 'ConsultarRucDV',
      timestamp: new Date(),
      metadata: { success: response.success, code: response.code, message: response.message }
    });

    // Mapear campos específicos
    // FIX: Castear a any por PascalCase/camelCase inconsistente
    const responseData = response.data as any;
    // A veces HKA devuelve la data anidada en infoRuc o InfoRuc
    const rucData = responseData?.infoRuc || responseData?.InfoRuc || responseData;

    if (response.success && rucData) {
      response.data = {
        ruc: rucData.ruc || rucData.RUC || '',
        dv: rucData.dv || rucData.DV || '',
        razonSocial: rucData.razonSocial || rucData.RazonSocial || '',
        tipoRuc: rucData.tipoRuc || rucData.TipoRuc || '',
        afiliadoFE: rucData.afiliadoFE || rucData.AfiliadoFE || '',
      } as ConsultarRucDVResponse;
    }

    return response;
  } catch (error) {
    const hkaError = error instanceof HKAError
      ? error
      : parseHKAError(undefined, error instanceof Error ? error.message : 'Error desconocido');

    return {
      success: false,
      code: hkaError.code || 'CLIENT_ERROR',
      message: hkaError.toUserMessage(),
    };
  }
}

/**
 * Método DescargaPDF - Descargar PDF de factura
 * Retorna el documento en Base64
 */
export async function descargarPDF(
  config: HKAConfig,
  datosDocumento: DatosDocumento
): Promise<HKAResponse<DescargaResponse>> {
  try {
    const client = await getHKASoapClient(config);

    const args = {
      tokenEmpresa: config.tokenEmpresa,
      tokenPassword: config.tokenPassword,
      datosDocumento: {
        codigoSucursalEmisor: datosDocumento.codigoSucursalEmisor,
        numeroDocumentoFiscal: datosDocumento.numeroDocumentoFiscal,
        puntoFacturacionFiscal: datosDocumento.puntoFacturacionFiscal,
        tipoDocumento: datosDocumento.tipoDocumento,
        tipoEmision: datosDocumento.tipoEmision,
      },
    };

    logger.log({
      level: 'INFO',
      method: 'DescargaPDF',
      timestamp: new Date(),
      metadata: { action: 'Calling SOAP', datosDocumento }
    });
    const rawResponse = await callSoapMethod(client, 'DescargaPDF', args);
    const response = processHKAResponse<DescargaResponse>(rawResponse, 'DescargaPDFResult');
    logger.log({
      level: response.success ? 'INFO' : 'WARN',
      method: 'DescargaPDF',
      timestamp: new Date(),
      metadata: { success: response.success, code: response.code, message: response.message }
    });

    // Mapear campos específicos
    // FIX: Castear a any por PascalCase/camelCase inconsistente
    const responseData = response.data as any;
    if (response.success && responseData) {
      response.data = {
        documento: responseData.documento || responseData.Documento || '',
      } as DescargaResponse;
    }

    return response;
  } catch (error) {
    const hkaError = error instanceof HKAError
      ? error
      : parseHKAError(undefined, error instanceof Error ? error.message : 'Error desconocido');

    return {
      success: false,
      code: hkaError.code || 'CLIENT_ERROR',
      message: hkaError.toUserMessage(),
    };
  }
}

/**
 * Método DescargaXML - Descargar XML firmado de factura
 * Retorna el documento en Base64
 */
export async function descargarXML(
  config: HKAConfig,
  datosDocumento: DatosDocumento
): Promise<HKAResponse<DescargaResponse>> {
  try {
    const client = await getHKASoapClient(config);

    const args = {
      tokenEmpresa: config.tokenEmpresa,
      tokenPassword: config.tokenPassword,
      datosDocumento: {
        codigoSucursalEmisor: datosDocumento.codigoSucursalEmisor,
        numeroDocumentoFiscal: datosDocumento.numeroDocumentoFiscal,
        puntoFacturacionFiscal: datosDocumento.puntoFacturacionFiscal,
        tipoDocumento: datosDocumento.tipoDocumento,
        tipoEmision: datosDocumento.tipoEmision,
      },
    };

    logger.log({
      level: 'INFO',
      method: 'DescargaXML',
      timestamp: new Date(),
      metadata: { action: 'Calling SOAP', datosDocumento }
    });
    const rawResponse = await callSoapMethod(client, 'DescargaXML', args);
    const response = processHKAResponse<DescargaResponse>(rawResponse, 'DescargaXMLResult');
    logger.log({
      level: response.success ? 'INFO' : 'WARN',
      method: 'DescargaXML',
      timestamp: new Date(),
      metadata: { success: response.success, code: response.code, message: response.message }
    });

    // Mapear campos específicos
    // FIX: Castear a any por PascalCase/camelCase inconsistente
    const responseData = response.data as any;
    if (response.success && responseData) {
      response.data = {
        documento: responseData.documento || responseData.Documento || '',
      } as DescargaResponse;
    }

    return response;
  } catch (error) {
    const hkaError = error instanceof HKAError
      ? error
      : parseHKAError(undefined, error instanceof Error ? error.message : 'Error desconocido');

    return {
      success: false,
      code: hkaError.code || 'CLIENT_ERROR',
      message: hkaError.toUserMessage(),
    };
  }
}

/**
 * Método AnulacionDocumento - Anular una factura emitida
 * 
 * ATENCIÓN: Este método es específico del paradigma WS Directo.
 * NO confundir con métodos de PAC (rEvAnulaFe). No se deben mezclar paradigmas.
 * Requiere motivo de anulación y datos originales del documento.
 */
export async function anularDocumento(
  config: HKAConfig,
  datosDocumento: DatosDocumento,
  motivoAnulacion: string
): Promise<HKAResponse<void>> {
  try {
    const client = await getHKASoapClient(config);

    const args = {
      tokenEmpresa: config.tokenEmpresa,
      tokenPassword: config.tokenPassword,
      motivoAnulacion: motivoAnulacion,
      datosDocumento: datosDocumento,
    };

    logger.log({
      level: 'INFO',
      method: 'AnulacionDocumento',
      timestamp: new Date(),
      metadata: { action: 'Calling SOAP', datosDocumento, motivoLength: motivoAnulacion.length }
    });
    const rawResponse = await callSoapMethod(client, 'AnulacionDocumento', args);
    const response = processHKAResponse<void>(rawResponse, 'AnulacionDocumentoResult');
    logger.log({
      level: response.success ? 'INFO' : 'WARN',
      method: 'AnulacionDocumento',
      timestamp: new Date(),
      metadata: { success: response.success, code: response.code, message: response.message }
    });
    return response;
  } catch (error) {
    const hkaError = error instanceof HKAError
      ? error
      : parseHKAError(undefined, error instanceof Error ? error.message : 'Error desconocido');

    return {
      success: false,
      code: hkaError.code || 'CLIENT_ERROR',
      message: hkaError.toUserMessage(),
    };
  }
}

/**
 * Método EnvioCorreo - Enviar factura por correo electrónico
 */
export async function enviarCorreo(
  config: HKAConfig,
  datosDocumento: DatosDocumento,
  correo: string
): Promise<HKAResponse<void>> {
  try {
    const client = await getHKASoapClient(config);

    const args = {
      tokenEmpresa: config.tokenEmpresa,
      tokenPassword: config.tokenPassword,
      datosDocumento: datosDocumento,
      correo: correo,
    };

    logger.log({
      level: 'INFO',
      method: 'EnvioCorreo',
      timestamp: new Date(),
      metadata: { action: 'Calling SOAP', datosDocumento, correo }
    });
    const rawResponse = await callSoapMethod(client, 'EnvioCorreo', args);
    const response = processHKAResponse<void>(rawResponse, 'EnvioCorreoResult');
    logger.log({
      level: response.success ? 'INFO' : 'WARN',
      method: 'EnvioCorreo',
      timestamp: new Date(),
      metadata: { success: response.success, code: response.code, message: response.message }
    });
    return response;
  } catch (error) {
    const hkaError = error instanceof HKAError
      ? error
      : parseHKAError(undefined, error instanceof Error ? error.message : 'Error desconocido');

    return {
      success: false,
      code: hkaError.code || 'CLIENT_ERROR',
      message: hkaError.toUserMessage(),
    };
  }
}

/**
 * Método RastreoCorreo - Rastrear estado de correos enviados
 * Usa CUFE en lugar de DatosDocumento
 */
export async function rastrearCorreo(
  config: HKAConfig,
  cufe: string
): Promise<HKAResponse<RastreoCorreoResponse>> {
  try {
    const client = await getHKASoapClient(config);

    // NOTA: El campo se llama "CUFE" en mayúsculas en el WSDL de HKA para este método.
    // A diferencia de los demás métodos que usan datosDocumento, RastreoCorreo
    // identifica el documento directamente por su CUFE en un tag <tem:CUFE>.
    const args = {
      tokenEmpresa: config.tokenEmpresa,
      tokenPassword: config.tokenPassword,
      CUFE: cufe,
    };

    logger.log({
      level: 'INFO',
      method: 'RastreoCorreo',
      timestamp: new Date(),
      metadata: { action: 'Calling SOAP', cufe }
    });
    const rawResponse = await callSoapMethod(client, 'RastreoCorreo', args);
    const response = processHKAResponse<RastreoCorreoResponse>(rawResponse, 'RastreoCorreoResult');
    logger.log({
      level: response.success ? 'INFO' : 'WARN',
      method: 'RastreoCorreo',
      timestamp: new Date(),
      metadata: { success: response.success, code: response.code, message: response.message }
    });
    return response;
  } catch (error) {
    const hkaError = error instanceof HKAError
      ? error
      : parseHKAError(undefined, error instanceof Error ? error.message : 'Error desconocido');

    return {
      success: false,
      code: hkaError.code || 'CLIENT_ERROR',
      message: hkaError.toUserMessage(),
    };
  }
}

// ============================================
// EXPORTS
// ============================================

export const HKAClient = {
  enviarFactura,
  consultarEstadoDocumento,
  consultarFoliosRestantes,
  consultarRucDV,
  descargarPDF,
  descargarXML,
  anularDocumento,
  enviarCorreo,
  rastrearCorreo,
};

export default HKAClient;
