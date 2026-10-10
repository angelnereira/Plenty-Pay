/**
 * Script de depuración HKA - Comparar request actual vs Postman
 * 
 * Este script te mostrará EXACTAMENTE qué está enviando tu sistema
 * para que puedas compararlo con lo que funciona en Postman
 */

import { buildFoliosRestantesXML } from '../lib/hka/xml-builder';
import { HKA_ENDPOINTS } from '../lib/hka/types';

// =====================================================
// PASO 1: Coloca aquí tus credenciales HKA reales
// =====================================================
const TOKEN_EMPRESA = 'TU_TOKEN_EMPRESA_AQUI';
const TOKEN_PASSWORD = 'TU_TOKEN_PASSWORD_AQUI';
const ENVIRONMENT: 'demo' | 'prod' = 'demo';

// =====================================================
// PASO 2: Generar el XML que tu sistema construye
// =====================================================
console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 DIAGNÓSTICO HKA - Comparación Sistema vs Postman');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📝 MÉTODO DE PRUEBA: FoliosRestantes (el más simple)');
console.log('   Razón: Sin parámetros complejos, ideal para debugging\n');

// Construir XML usando tu sistema actual
const xmlGenerado = buildFoliosRestantesXML(TOKEN_EMPRESA, TOKEN_PASSWORD);

console.log('───────────────────────────────────────────────────────────');
console.log('📤 XML GENERADO POR TU SISTEMA:');
console.log('───────────────────────────────────────────────────────────');
console.log(xmlGenerado);
console.log('');

// =====================================================
// PASO 3: Ver configuración HTTP actual
// =====================================================
const endpoint = HKA_ENDPOINTS[ENVIRONMENT];
const soapAction = `http://tempuri.org/IService/FoliosRestantes`;

console.log('───────────────────────────────────────────────────────────');
console.log('🌐 CONFIGURACIÓN HTTP DE TU SISTEMA:');
console.log('───────────────────────────────────────────────────────────');
console.log(`Endpoint: ${endpoint}`);
console.log(`Method: POST`);
console.log(`Headers:`);
console.log(`  Content-Type: text/xml; charset=utf-8`);
console.log(`  SOAPAction: ${soapAction}`);
console.log(`  Content-Length: ${Buffer.byteLength(xmlGenerado)}`);
console.log('');

// =====================================================
// PASO 4: XML que DEBERÍA funcionar (referencia Postman)
// =====================================================
const xmlReferenciaPostman = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:ser="http://schemas.datacontract.org/2004/07/Services">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:FoliosRestantes>
      <tem:tokenEmpresa>${TOKEN_EMPRESA}</tem:tokenEmpresa>
      <tem:tokenPassword>${TOKEN_PASSWORD}</tem:tokenPassword>
    </tem:FoliosRestantes>
  </soapenv:Body>
</soapenv:Envelope>`;

console.log('───────────────────────────────────────────────────────────');
console.log('✅ XML DE REFERENCIA (formato Postman):');
console.log('───────────────────────────────────────────────────────────');
console.log(xmlReferenciaPostman);
console.log('');

// =====================================================
// PASO 5: Comparación byte a byte
// =====================================================
console.log('───────────────────────────────────────────────────────────');
console.log('🔬 ANÁLISIS DE DIFERENCIAS:');
console.log('───────────────────────────────────────────────────────────');

// Normalizar ambos XMLs (quitar espacios extras, saltos de línea)
const normalizar = (xml: string) => xml.replace(/>\s+</g, '><').trim();
const xmlSistemaNormalizado = normalizar(xmlGenerado);
const xmlReferenciaNormalizado = normalizar(xmlReferenciaPostman);

console.log(`Tamaño XML Sistema:     ${Buffer.byteLength(xmlGenerado)} bytes`);
console.log(`Tamaño XML Referencia:  ${Buffer.byteLength(xmlReferenciaPostman)} bytes`);
console.log(`Tamaño normalizado Sistema:    ${xmlSistemaNormalizado.length} chars`);
console.log(`Tamaño normalizado Referencia: ${xmlReferenciaNormalizado.length} chars`);
console.log('');

if (xmlSistemaNormalizado === xmlReferenciaNormalizado) {
    console.log('✅ ¡XML IDÉNTICOS! El problema NO está en la construcción del XML.');
    console.log('   👉 Revisa Headers HTTP, SOAPAction o credenciales.');
} else {
    console.log('❌ XMLs DIFERENTES. Encontrando diferencias...\n');

    // Encontrar primera diferencia
    const maxLen = Math.max(xmlSistemaNormalizado.length, xmlReferenciaNormalizado.length);
    let primeraDiferencia = -1;

    for (let i = 0; i < maxLen; i++) {
        if (xmlSistemaNormalizado[i] !== xmlReferenciaNormalizado[i]) {
            primeraDiferencia = i;
            break;
        }
    }

    if (primeraDiferencia !== -1) {
        const contextoInicio = Math.max(0, primeraDiferencia - 50);
        const contextoFin = Math.min(maxLen, primeraDiferencia + 50);

        console.log(`Primera diferencia en posición ${primeraDiferencia}:`);
        console.log('');
        console.log('TU SISTEMA:');
        console.log(xmlSistemaNormalizado.substring(contextoInicio, contextoFin));
        console.log(' '.repeat(primeraDiferencia - contextoInicio) + '^ AQUÍ');
        console.log('');
        console.log('REFERENCIA:');
        console.log(xmlReferenciaNormalizado.substring(contextoInicio, contextoFin));
        console.log(' '.repeat(primeraDiferencia - contextoInicio) + '^ AQUÍ');
    }
}

console.log('');
console.log('───────────────────────────────────────────────────────────');
console.log('🧪 CHECKLIST DE VALIDACIÓN:');
console.log('───────────────────────────────────────────────────────────');
console.log('[ ] 1. XML declaration tiene <?xml version="1.0" encoding="UTF-8"?>');
console.log('[ ] 2. Namespaces exactos: soapenv, tem, ser');
console.log('[ ] 3. SOAPAction header usa http://tempuri.org/IService/...');
console.log('[ ] 4. Content-Type es text/xml; charset=utf-8');
console.log('[ ] 5. Credenciales son correctas y válidas');
console.log('[ ] 6. Endpoint correcto (demo vs prod)');
console.log('');

// =====================================================
// PASO 6: Hacer el request real para ver qué pasa
// =====================================================
console.log('───────────────────────────────────────────────────────────');
console.log('🚀 HACIENDO REQUEST REAL CON TU SISTEMA...');
console.log('───────────────────────────────────────────────────────────');

async function hacerRequestReal() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        console.log(`\n📡 Enviando a: ${endpoint}`);
        console.log(`⏱️  Timeout: 30 segundos\n`);

        const startTime = Date.now();

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': soapAction,
            },
            body: xmlGenerado,
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        console.log(`✅ Respuesta recibida en ${duration}ms`);
        console.log(`📊 Status: ${response.status} ${response.statusText}`);
        console.log(`📋 Headers recibidos:`);
        response.headers.forEach((value, key) => {
            console.log(`   ${key}: ${value}`);
        });

        const responseBody = await response.text();

        console.log('\n───────────────────────────────────────────────────────────');
        console.log('📥 RESPUESTA DEL SERVIDOR:');
        console.log('───────────────────────────────────────────────────────────');
        console.log(responseBody);
        console.log('');

        // Analizar la respuesta
        if (responseBody.includes('soap:Fault') || responseBody.includes('Fault')) {
            console.log('❌ SOAP FAULT DETECTADO');
            const faultMatch = responseBody.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
            if (faultMatch) {
                console.log(`   Error: ${faultMatch[1]}`);
            }
        } else if (responseBody.includes('FoliosRestantesResult')) {
            console.log('✅ RESPUESTA EXITOSA - Método funcionó correctamente');

            // Extraer código
            const codigoMatch = responseBody.match(/<a:codigo[^>]*>([^<]+)<\/a:codigo>/i);
            if (codigoMatch) {
                console.log(`   Código: ${codigoMatch[1]}`);

                if (codigoMatch[1] === '200') {
                    console.log('   🎉 ¡SUCCESS! El método está funcionando.');

                    // Extraer folios
                    const foliosMatch = responseBody.match(/<a:foliosDisponiblesCiclo[^>]*>([^<]+)<\/a:foliosDisponiblesCiclo>/i);
                    if (foliosMatch) {
                        console.log(`   📊 Folios disponibles: ${foliosMatch[1]}`);
                    }
                } else {
                    const mensajeMatch = responseBody.match(/<a:mensaje[^>]*>([^<]+)<\/a:mensaje>/i);
                    console.log(`   ⚠️  Error HKA: ${mensajeMatch ? mensajeMatch[1] : 'Sin mensaje'}`);
                }
            }
        } else {
            console.log('⚠️  Respuesta inesperada - No es Fault ni resultado conocido');
        }

    } catch (error: any) {
        console.log('❌ ERROR EN LA LLAMADA:');
        console.log(`   Tipo: ${error.name}`);
        console.log(`   Mensaje: ${error.message}`);

        if (error.name === 'AbortError') {
            console.log('   ⏱️  TIMEOUT - El servidor no respondió en 30 segundos');
        } else if (error.code === 'ENOTFOUND') {
            console.log('   🌐 DNS ERROR - No se puede resolver el dominio');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('   🔌 CONNECTION REFUSED - El servidor rechazó la conexión');
        }
    }
}

// Solo ejecutar si las credenciales fueron configuradas
if (TOKEN_EMPRESA !== 'TU_TOKEN_EMPRESA_AQUI') {
    hacerRequestReal().then(() => {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🏁 FIN DEL DIAGNÓSTICO');
        console.log('═══════════════════════════════════════════════════════════');
    });
} else {
    console.log('⚠️  SALTANDO REQUEST REAL - Configura tus credenciales primero');
    console.log('   Edita este archivo y reemplaza TOKEN_EMPRESA y TOKEN_PASSWORD');
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🏁 FIN DEL DIAGNÓSTICO (modo inspección)');
    console.log('═══════════════════════════════════════════════════════════');
}
