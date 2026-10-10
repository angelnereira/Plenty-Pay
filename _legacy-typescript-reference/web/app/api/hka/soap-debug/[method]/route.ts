/**
 * API Route: HKA SOAP Debug - Endpoint Genérico para TODOS los métodos
 * 
 * Devuelve la respuesta XML SOAP 1.1 cruda de HKA sin parsear
 * Soporta los 9 métodos HKA: Enviar, EstadoDocumento, FoliosRestantes, 
 * ConsultarRucDV, DescargaPDF, DescargaXML, AnulacionDocumento, EnvioCorreo, RastreoCorreo
 * 
 * POST /api/hka/soap-debug/[method]
 * 
 * Ejemplo: POST /api/hka/soap-debug/ConsultarRucDV
 * Query param: ?showRequest=true para ver ambos request y response XML
 */

import { NextRequest } from 'next/server';
import { auth } from '@core/auth';
import { getHKAConfig } from '@/features/hka/model/repositories/hka-config.repository';
import { getHKASoapClient, callSoapMethod } from '@/features/hka/model/services/hka-soap-client.service';

// Métodos HKA permitidos
const ALLOWED_METHODS = [
    'Enviar',
    'EstadoDocumento',
    'FoliosRestantes',
    'ConsultarRucDV',
    'DescargaPDF',
    'DescargaXML',
    'AnulacionDocumento',
    'EnvioCorreo',
    'RastreoCorreo',
] as const;

type HKAMethod = typeof ALLOWED_METHODS[number];

/**
 * Construye los argumentos SOAP según el método
 */
function buildSoapArgs(
    method: HKAMethod,
    config: { tokenEmpresa: string; tokenPassword: string },
    body: any
): any {
    const { tokenEmpresa, tokenPassword } = config;

    switch (method) {
        case 'Enviar':
            return {
                tokenEmpresa,
                tokenPassword,
                documento: body.documento,
            };

        case 'EstadoDocumento':
        case 'DescargaPDF':
        case 'DescargaXML':
            return {
                tokenEmpresa,
                tokenPassword,
                datosDocumento: {
                    codigoSucursalEmisor: body.codigoSucursalEmisor || '0000',
                    tipoDocumento: body.tipoDocumento || '01',
                    numeroDocumentoFiscal: body.numeroDocumentoFiscal,
                    puntoFacturacionFiscal: body.puntoFacturacionFiscal || '001',
                    fechaEmision: body.fechaEmision,
                },
            };

        case 'FoliosRestantes':
            return {
                tokenEmpresa,
                tokenPassword,
            };

        case 'ConsultarRucDV':
            return {
                consultarRucDVRequest: {
                    tokenEmpresa,
                    tokenPassword,
                    tipoRuc: body.tipoRuc || '2',
                    ruc: body.ruc,
                },
            };

        case 'AnulacionDocumento':
            return {
                tokenEmpresa,
                tokenPassword,
                motivoAnulacion: body.motivoAnulacion || 'Anulación solicitada',
                datosDocumento: {
                    codigoSucursalEmisor: body.codigoSucursalEmisor || '0000',
                    tipoDocumento: body.tipoDocumento || '01',
                    numeroDocumentoFiscal: body.numeroDocumentoFiscal,
                    puntoFacturacionFiscal: body.puntoFacturacionFiscal || '001',
                    fechaEmision: body.fechaEmision,
                },
            };

        case 'EnvioCorreo':
            return {
                tokenEmpresa,
                tokenPassword,
                correo: body.correo,
                datosDocumento: {
                    codigoSucursalEmisor: body.codigoSucursalEmisor || '0000',
                    tipoDocumento: body.tipoDocumento || '01',
                    numeroDocumentoFiscal: body.numeroDocumentoFiscal,
                    puntoFacturacionFiscal: body.puntoFacturacionFiscal || '001',
                    fechaEmision: body.fechaEmision,
                },
            };

        case 'RastreoCorreo':
            return {
                tokenEmpresa,
                tokenPassword,
                cufe: body.cufe,
            };

        default:
            throw new Error(`Método no soportado: ${method}`);
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ method: string }> }
) {
    try {
        const { method: methodStr } = await params;
        const method = methodStr as HKAMethod;

        // Validar método
        if (!ALLOWED_METHODS.includes(method)) {
            return new Response(
                `<?xml version="1.0" encoding="utf-8"?>
<Error>
  <mensaje>Método no permitido: ${method}</mensaje>
  <metodosPermitidos>${ALLOWED_METHODS.join(', ')}</metodosPermitidos>
</Error>`,
                {
                    status: 400,
                    headers: { 'Content-Type': 'text/xml; charset=utf-8' }
                }
            );
        }

        // Autenticación
        const session = await auth();
        if (!session?.user?.id || !session?.user?.clientId) {
            return new Response(
                '<?xml version="1.0" encoding="utf-8"?><Error>No autorizado</Error>',
                {
                    status: 401,
                    headers: { 'Content-Type': 'text/xml; charset=utf-8' }
                }
            );
        }

        const { clientId } = session.user;

        // Obtener body (puede estar vacío para FoliosRestantes)
        let body = {};
        try {
            body = await request.json();
        } catch {
            // Body vacío es válido para FoliosRestantes
        }

        // Obtener configuración HKA
        const config = await getHKAConfig(clientId);

        // Crear cliente SOAP
        const client = await getHKASoapClient(config);

        // Construir argumentos según método
        const args = buildSoapArgs(method, {
            tokenEmpresa: config.tokenEmpresa,
            tokenPassword: config.tokenPassword,
        }, body);

        console.log(`[SOAP-DEBUG] Calling ${method} with args:`, JSON.stringify(args, null, 2));

        // Llamar método SOAP (esto captura lastRequest y lastResponse)
        try {
            await callSoapMethod(client, method, args);
        } catch (soapError) {
            // Aún intentamos obtener el XML aunque falle
            console.error(`[SOAP-DEBUG] SOAP error for ${method}:`, soapError);
        }

        // Obtener XML crudo de la respuesta
        const rawXmlResponse = client.lastResponse || '';
        const rawXmlRequest = client.lastRequest || '';

        // Decidir qué devolver basado en query param
        const url = new URL(request.url);
        const showRequest = url.searchParams.get('showRequest') === 'true';

        if (showRequest) {
            // Devolver objeto con ambos XMLs como JSON
            return new Response(
                JSON.stringify({
                    method,
                    request: rawXmlRequest,
                    response: rawXmlResponse,
                }, null, 2),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                }
            );
        }

        // Devolver solo el XML de respuesta SOAP 1.1 crudo
        return new Response(rawXmlResponse || '<NoResponse/>', {
            status: 200,
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'X-HKA-Method': method,
            },
        });

    } catch (error) {
        console.error('[SOAP-DEBUG] Error:', error);

        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        const errorXml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Body>
    <s:Fault>
      <faultcode>s:Server</faultcode>
      <faultstring>${errorMessage}</faultstring>
    </s:Fault>
  </s:Body>
</s:Envelope>`;

        return new Response(errorXml, {
            status: 500,
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
            },
        });
    }
}

// GET para documentación
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ method: string }> }
) {
    const { method } = await params;

    const docXml = `<?xml version="1.0" encoding="utf-8"?>
<HKASoapDebug>
  <endpoint>/api/hka/soap-debug/${method}</endpoint>
  <httpMethod>POST</httpMethod>
  <description>Devuelve la respuesta XML SOAP 1.1 cruda de HKA para el método ${method}</description>
  <queryParams>
    <param name="showRequest">true para incluir el XML del request en la respuesta (como JSON)</param>
  </queryParams>
  <metodosDisponibles>${ALLOWED_METHODS.join(', ')}</metodosDisponibles>
  <ejemplos>
    <ejemplo metodo="FoliosRestantes">
      POST /api/hka/soap-debug/FoliosRestantes
      Body: {} (vacío)
    </ejemplo>
    <ejemplo metodo="ConsultarRucDV">
      POST /api/hka/soap-debug/ConsultarRucDV
      Body: {"ruc": "155596713-2-2015", "tipoRuc": "2"}
    </ejemplo>
    <ejemplo metodo="EstadoDocumento">
      POST /api/hka/soap-debug/EstadoDocumento  
      Body: {"numeroDocumentoFiscal": "0000000001", "fechaEmision": "2025-12-11"}
    </ejemplo>
  </ejemplos>
</HKASoapDebug>`;

    return new Response(docXml, {
        status: 200,
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
        },
    });
}
