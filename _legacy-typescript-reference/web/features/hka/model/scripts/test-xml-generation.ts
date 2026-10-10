/**
 * Script de Prueba: Generación y Validación de XML SOAP
 *
 * Este script genera un XML SOAP usando exactamente los mismos datos
 * del ejemplo oficial de la documentación HKA 2026 (líneas 535-675)
 *
 * Propósito:
 * 1. Verificar que el namespace 'ser' sea correcto
 * 2. Validar estructura del XML generado
 * 3. Comparar contra ejemplo oficial
 * 4. Permitir debugging visual del XML
 *
 * Uso:
 * ```bash
 * npx tsx lib/features/hka/scripts/test-xml-generation.ts
 * ```
 */

import { buildEnviarXML } from '../services/hka-xml.service';
import type { DocumentoElectronico } from '../types/types';

// ============================================
// DOCUMENTO DE EJEMPLO OFICIAL
// ============================================

/**
 * Documento exacto del ejemplo PHP de la documentación oficial (líneas 535-675)
 * Datos de prueba que HKA DEMO debe aceptar
 */
const DOCUMENTO_EJEMPLO_OFICIAL: DocumentoElectronico = {
  codigoSucursalEmisor: "0000",
  tipoSucursal: "1",
  datosTransaccion: {
    tipoEmision: "01",
    tipoDocumento: "01",
    numeroDocumentoFiscal: "0000000001",
    puntoFacturacionFiscal: "001",
    fechaEmision: "2019-05-28T00:00:00-05:00",
    naturalezaOperacion: "01",
    tipoOperacion: "1",
    destinoOperacion: "1",
    formatoCAFE: "1",
    entregaCAFE: "1",
    envioContenedor: "1",
    procesoGeneracion: "1",
    tipoVenta: "1",
    informacionInteres: "Prueba de Información de interés",
    cliente: {
      tipoClienteFE: "01",
      tipoContribuyente: "2",
      numeroRUC: "155596713-2-2015",
      digitoVerificadorRUC: "59",
      razonSocial: "FE general",
      direccion: "Av. Balboa",
      codigoUbicacion: "1-2-3",
      corregimiento: "Guabito",
      distrito: "Changuinola",
      provincia: "Bocas del Toro",
      telefono1: "997-8243",
      correoElectronico1: "fep@gmail.com",
      pais: "PA",
    }
  },
  listaItems: [{
    descripcion: "Cuadernos",
    codigo: "T",
    unidadMedida: "und",
    cantidad: "2.00",
    precioUnitario: "69.00",
    precioUnitarioDescuento: "0.00",
    precioItem: "138.00",
    valorTotal: "171.72",
    tasaITBMS: "03",
    valorITBMS: "20.70",
    tasaISC: "0.00",
    valorISC: "0.00",
    codigoCPBS: "1410",
  }],
  totalesSubTotales: {
    totalPrecioNeto: "138.00",
    totalITBMS: "20.70",
    totalISC: "0.00",
    totalMontoGravado: "20.70",
    totalFactura: "171.72",
    totalValorRecibido: "171.72",
    vuelto: "0.00",
    tiempoPago: "1",
    nroItems: "1",
    totalTodosItems: "171.72",
    listaFormaPago: [{
      formaPagoFact: "02",
      valorCuotaPagada: "171.72",
    }]
  }
};

// ============================================
// TOKENS DE PRUEBA
// ============================================

const TOKEN_EMPRESA_DEMO = "SOLICITAR_A_HKA";
const TOKEN_PASSWORD_DEMO = "SOLICITAR_A_HKA";

// ============================================
// VALIDACIONES
// ============================================

/**
 * Extrae namespaces del XML
 */
function extractNamespaces(xml: string): Record<string, string> {
  const namespaces: Record<string, string> = {};

  // Buscar todos los atributos xmlns:*
  const regex = /xmlns:(\w+)="([^"]+)"/g;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    namespaces[match[1]] = match[2];
  }

  return namespaces;
}

/**
 * Valida que el namespace 'ser' sea correcto
 */
function validateNamespace(xml: string): { valid: boolean; error?: string } {
  const namespaces = extractNamespaces(xml);

  const expectedNamespace = 'http://schemas.datacontract.org/2004/07/Services.ObjComprobante.v1_0';

  if (!namespaces['ser']) {
    return {
      valid: false,
      error: 'Namespace "ser" no encontrado en el XML'
    };
  }

  if (namespaces['ser'] !== expectedNamespace) {
    return {
      valid: false,
      error: `Namespace "ser" incorrecto.\nEsperado: ${expectedNamespace}\nObtenido: ${namespaces['ser']}`
    };
  }

  return { valid: true };
}

/**
 * Valida estructura básica del XML
 */
function validateXMLStructure(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Verificar elementos obligatorios
  const requiredElements = [
    'soapenv:Envelope',
    'soapenv:Header',
    'soapenv:Body',
    'tem:Enviar',
    'tem:tokenEmpresa',
    'tem:tokenPassword',
    'tem:documento',
    'ser:codigoSucursalEmisor',
    'ser:datosTransaccion',
    'ser:listaItems',
    'ser:totalesSubTotales',
  ];

  for (const element of requiredElements) {
    if (!xml.includes(`<${element}`)) {
      errors.push(`Elemento obligatorio no encontrado: <${element}>`);
    }
  }

  // Verificar que NO contenga campos vacíos (REGLA CRÍTICA HKA)
  const emptyTagsRegex = /<[^>]+><\/[^>]+>/g;
  const emptyTags = xml.match(emptyTagsRegex);
  if (emptyTags && emptyTags.length > 0) {
    errors.push(`Encontrados ${emptyTags.length} tags vacíos (HKA NO acepta tags vacíos): ${emptyTags.slice(0, 3).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Cuenta elementos específicos en el XML
 */
function countElements(xml: string): Record<string, number> {
  return {
    items: (xml.match(/<ser:item>/g) || []).length,
    formasPago: (xml.match(/<ser:formaPago>/g) || []).length,
    clienteElements: (xml.match(/<ser:cliente>/g) || []).length,
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('='.repeat(80));
  console.log('TEST: Generación y Validación de XML SOAP para HKA');
  console.log('='.repeat(80));
  console.log();

  // Generar XML
  console.log('📝 Generando XML SOAP...');
  const xml = buildEnviarXML(
    TOKEN_EMPRESA_DEMO,
    TOKEN_PASSWORD_DEMO,
    DOCUMENTO_EJEMPLO_OFICIAL
  );

  console.log(`✅ XML generado (${xml.length} caracteres)\n`);

  // Extraer y mostrar namespaces
  console.log('🔍 Namespaces detectados:');
  const namespaces = extractNamespaces(xml);
  for (const [prefix, uri] of Object.entries(namespaces)) {
    console.log(`   ${prefix}: ${uri}`);
  }
  console.log();

  // Validar namespace 'ser'
  console.log('🔍 Validando namespace "ser"...');
  const nsResult = validateNamespace(xml);
  if (nsResult.valid) {
    console.log('   ✅ Namespace "ser" CORRECTO');
  } else {
    console.log(`   ❌ ERROR: ${nsResult.error}`);
  }
  console.log();

  // Validar estructura
  console.log('🔍 Validando estructura XML...');
  const structResult = validateXMLStructure(xml);
  if (structResult.valid) {
    console.log('   ✅ Estructura válida');
  } else {
    console.log('   ❌ Errores encontrados:');
    structResult.errors.forEach(error => console.log(`      - ${error}`));
  }
  console.log();

  // Contar elementos
  console.log('📊 Estadísticas del XML:');
  const counts = countElements(xml);
  console.log(`   Items: ${counts.items}`);
  console.log(`   Formas de pago: ${counts.formasPago}`);
  console.log(`   Cliente: ${counts.clienteElements > 0 ? 'Incluido' : 'NO incluido'}`);
  console.log();

  // Mostrar XML completo
  console.log('📄 XML Completo:');
  console.log('-'.repeat(80));
  console.log(xml);
  console.log('-'.repeat(80));
  console.log();

  // Resumen final
  console.log('📋 RESUMEN:');
  const allValid = nsResult.valid && structResult.valid;
  if (allValid) {
    console.log('   ✅ XML VÁLIDO - Listo para enviar a HKA');
    console.log('   ✅ Namespace correcto');
    console.log('   ✅ Estructura completa');
    console.log('   ✅ Sin tags vacíos');
  } else {
    console.log('   ❌ XML INVÁLIDO - Requiere correcciones');
    if (!nsResult.valid) console.log('   ❌ Namespace incorrecto');
    if (!structResult.valid) console.log('   ❌ Problemas de estructura');
  }
  console.log();

  console.log('='.repeat(80));
  console.log('NOTA: Reemplace TOKEN_EMPRESA_DEMO y TOKEN_PASSWORD_DEMO');
  console.log('      con sus credenciales reales de HKA DEMO para probar');
  console.log('='.repeat(80));
}

// Ejecutar
main().catch(error => {
  console.error('Error al ejecutar el test:', error);
  process.exit(1);
});
