/**
 * Test HKA al estilo Postman - Método crudo sin procesamiento
 * 
 * Este script hace exactamente lo que Postman hace:
 * - Request HTTP POST simple
 * - XML hardcoded (copia el que funciona en Postman)
 * - Sin parsers, sin librerías, solo fetch + console.log
 */

import * as https from 'https';

// =====================================================
// CONFIGURACIÓN - Copia tu request de Postman aquí
// =====================================================

const ENDPOINT = 'https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc';

// 👇 PEGA AQUÍ EL XML EXACTO QUE FUNCIONA EN POSTMAN
const XML_QUE_FUNCIONA_EN_POSTMAN = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:ser="http://schemas.datacontract.org/2004/07/Services">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:FoliosRestantes>
      <tem:tokenEmpresa>TU_TOKEN_EMPRESA</tem:tokenEmpresa>
      <tem:tokenPassword>TU_TOKEN_PASSWORD</tem:tokenPassword>
    </tem:FoliosRestantes>
  </soapenv:Body>
</soapenv:Envelope>`;

// 👇 Headers exactos de Postman
const HEADERS = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': 'http://tempuri.org/IService/FoliosRestantes', // ⚠️ Verifica este valor
    'Content-Length': Buffer.byteLength(XML_QUE_FUNCIONA_EN_POSTMAN).toString(),
};

// =====================================================
// Función de envío cruda (estilo Postman)
// =====================================================

async function sendRawSOAP(url: string, xml: string, headers: Record<string, string>): Promise<{
    status: number;
    headers: https.IncomingHttpHeaders;
    body: string;
}> {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        const options: https.RequestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers,
            timeout: 30000,
        };

        console.log('🚀 Haciendo request HTTP...');
        console.log(`   Host: ${options.hostname}`);
        console.log(`   Port: ${options.port}`);
        console.log(`   Path: ${options.path}`);
        console.log(`   Method: ${options.method}`);
        console.log('   Headers:', headers);
        console.log('');

        const req = https.request(options, (res) => {
            let body = '';
            res.setEncoding('utf8');

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                resolve({
                    status: res.statusCode || 0,
                    headers: res.headers,
                    body,
                });
            });
        });

        req.on('error', (err) => {
            console.error('❌ Request error:', err);
            reject(err);
        });

        req.on('timeout', () => {
            console.error('⏱️  Request timeout');
            req.destroy(new Error('Request timeout'));
        });

        console.log('📤 Enviando XML...');
        console.log(xml);
        console.log('');

        req.write(xml);
        req.end();
    });
}

// =====================================================
// Ejecución
// =====================================================

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 TEST ESTILO POSTMAN - Request Crudo');
console.log('═══════════════════════════════════════════════════════════\n');

(async () => {
    try {
        const startTime = Date.now();
        const response = await sendRawSOAP(ENDPOINT, XML_QUE_FUNCIONA_EN_POSTMAN, HEADERS);
        const duration = Date.now() - startTime;

        console.log('✅ Respuesta recibida');
        console.log(`⏱️  Tiempo: ${duration}ms`);
        console.log(`📊 Status: ${response.status}`);
        console.log('📋 Response Headers:');
        Object.entries(response.headers).forEach(([key, value]) => {
            console.log(`   ${key}: ${value}`);
        });
        console.log('');
        console.log('───────────────────────────────────────────────────────────');
        console.log('📥 RESPONSE BODY:');
        console.log('───────────────────────────────────────────────────────────');
        console.log(response.body);
        console.log('');

        // Análisis simple
        if (response.body.includes('soap:Fault') || response.body.includes('Fault')) {
            console.log('❌ SOAP FAULT detectado');
            const faultMatch = response.body.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
            if (faultMatch) {
                console.log(`   Mensaje: ${faultMatch[1]}`);
            }
        } else if (response.body.includes('a:codigo>200<')) {
            console.log('✅ ¡ÉXITO! Código 200 recibido');
        } else if (response.body.match(/<a:codigo[^>]*>(\d+)</)) {
            const code = response.body.match(/<a:codigo[^>]*>(\d+)</)![1];
            console.log(`⚠️  Código HKA: ${code}`);
            const msgMatch = response.body.match(/<a:mensaje[^>]*>([^<]+)</);
            if (msgMatch) {
                console.log(`   Mensaje: ${msgMatch[1]}`);
            }
        }

    } catch (error: any) {
        console.error('\n❌ ERROR:');
        console.error(`   ${error.name}: ${error.message}`);
        console.error(error.stack);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🏁 FIN DEL TEST');
    console.log('═══════════════════════════════════════════════════════════');
})();

/*
📝 INSTRUCCIONES DE USO:

1. Abre Postman y haz tu request que funciona
2. Copia el XML EXACTO desde la pestaña "Body"
3. Pégalo en la constante XML_QUE_FUNCIONA_EN_POSTMAN
4. Verifica el SOAPAction en los headers de Postman
5. Ejecuta: npx tsx scripts/test-postman-style.ts
6. Compara la respuesta con lo que recibes en Postman

Si ESTE script funciona pero tu sistema no, el problema está en:
- Cómo se construye el XML (xml-builder.ts)
- Headers HTTP (soap-client.ts)
- Parsing de respuesta (xml-parser.ts)

Si ESTE script TAMPOCO funciona:
- Verifica las credenciales
- Verifica el endpoint (Demo vs Prod)
- Verifica el SOAPAction exacto
- Compara byte a byte el XML con el de Postman
*/
