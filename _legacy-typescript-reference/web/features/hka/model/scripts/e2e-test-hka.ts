/**
 * Script E2E: Test Completo de Integración con HKA
 *
 * Este script ejecuta un flujo completo de prueba:
 * 1. Test de conexión (FoliosRestantes)
 * 2. Envío de factura de prueba
 * 3. Consulta de estado del documento
 * 4. Descarga de PDF y XML (opcional)
 *
 * IMPORTANTE:
 * - Los tokens HKA se obtienen de la BASE DE DATOS (no de .env)
 * - Cada cliente tiene sus propios tokens configurados en su cuenta
 *
 * Uso:
 * ```bash
 * # Opción 1: Usar clientId (obtiene tokens de BD)
 * npx tsx lib/features/hka/scripts/e2e-test-hka.ts --client-id="tu-client-id-uuid"
 *
 * # Opción 2: Variables de ambiente (solo para testing manual del desarrollador)
 * export HKA_TOKEN_EMPRESA="tu_token_empresa"
 * export HKA_TOKEN_PASSWORD="tu_token_password"
 * npx tsx lib/features/hka/scripts/e2e-test-hka.ts
 * ```
 */

import {
  consultarFoliosRestantes,
  enviarFactura,
  consultarEstadoDocumento,
  descargarPDF,
  descargarXML,
} from '../services/hka-soap.service';
import { getHKAConfig } from '../repositories/hka-config.repository';
import type { HKAConfig, DocumentoElectronico, DatosDocumento } from '../types/types';

// ============================================
// CONFIGURACIÓN
// ============================================

/**
 * Obtiene la configuración HKA para testing
 * Primero intenta usar clientId, luego variables de ambiente
 */
async function getTestConfig(): Promise<HKAConfig> {
  // Opción 1: Usar clientId de argumento --client-id
  const clientIdArg = process.argv.find(arg => arg.startsWith('--client-id='));
  if (clientIdArg) {
    const clientId = clientIdArg.split('=')[1];
    console.log(`📋 Obteniendo configuración de BD para cliente: ${clientId}`);
    try {
      const config = await getHKAConfig(clientId);
      console.log(`✅ Configuración obtenida de BD (ambiente: ${config.environment})`);
      return config;
    } catch (error) {
      console.error(`❌ Error obteniendo config de BD: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }

  // Opción 2: Usar variables de ambiente (solo para testing manual)
  const tokenEmpresa = process.env.HKA_TOKEN_EMPRESA;
  const tokenPassword = process.env.HKA_TOKEN_PASSWORD;

  if (!tokenEmpresa || !tokenPassword) {
    console.error(`
❌ ERROR: No se encontró configuración HKA

Por favor use una de las siguientes opciones:

  1. Usar clientId (RECOMENDADO - obtiene tokens de BD):
     npx tsx lib/features/hka/scripts/e2e-test-hka.ts --client-id="uuid-del-cliente"

  2. Variables de ambiente (solo para testing manual):
     export HKA_TOKEN_EMPRESA="tu_token"
     export HKA_TOKEN_PASSWORD="tu_password"
     npx tsx lib/features/hka/scripts/e2e-test-hka.ts

NOTA IMPORTANTE:
Los tokens HKA NO deben estar en .env del repositorio.
Cada cliente tiene sus propios tokens almacenados en la base de datos.
    `);
    process.exit(1);
  }

  console.log(`⚠️  Usando variables de ambiente (testing manual)`);

  return {
    tokenEmpresa,
    tokenPassword,
    environment: 'demo',
    branchCode: '0000',
    tipoSucursal: '1',
    puntoFacturacionFiscal: '001',
    locationCode: '8-8-1',
    provincia: 'Panamá',
    distrito: 'Panamá',
    corregimiento: 'Ancón',
    tipoEmision: '01',
    destinoOperacion: '1',
    formatoCAFE: '1',
    entregaCAFE: '1',
    envioContenedor: '1',
    procesoGeneracion: '1',
  };
}

// Documento de prueba (mismo del ejemplo oficial)
const DOCUMENTO_PRUEBA: DocumentoElectronico = {
  codigoSucursalEmisor: "0000",
  tipoSucursal: "1",
  datosTransaccion: {
    tipoEmision: "01",
    tipoDocumento: "01",
    numeroDocumentoFiscal: `${Date.now().toString().slice(-10)}`, // Número único basado en timestamp
    puntoFacturacionFiscal: "001",
    fechaEmision: new Date().toISOString().replace(/\.\d{3}Z$/, '-05:00'),
    naturalezaOperacion: "01",
    tipoOperacion: "1",
    destinoOperacion: "1",
    formatoCAFE: "1",
    entregaCAFE: "1",
    envioContenedor: "1",
    procesoGeneracion: "1",
    tipoVenta: "1",
    informacionInteres: "Prueba E2E PlentyPay",
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
    codigo: "TEST-001",
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
// UTILIDADES
// ============================================

function logStep(stepNumber: number, title: string) {
  console.log();
  console.log('='.repeat(80));
  console.log(`PASO ${stepNumber}: ${title}`);
  console.log('='.repeat(80));
}

function logSuccess(message: string) {
  console.log(`✅ ${message}`);
}

function logError(message: string) {
  console.error(`❌ ${message}`);
}

function logInfo(message: string) {
  console.log(`ℹ️  ${message}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// TESTS
// ============================================

async function paso1_TestConexion(config: HKAConfig): Promise<boolean> {
  logStep(1, 'Test de Conexión (FoliosRestantes)');

  try {
    const startTime = Date.now();
    const result = await consultarFoliosRestantes(config);
    const duration = Date.now() - startTime;

    if (result.success && result.data) {
      logSuccess(`Conexión exitosa con HKA ${config.environment.toUpperCase()}`);
      logInfo(`Tiempo de respuesta: ${duration}ms`);
      logInfo(`Folios disponibles ciclo: ${result.data.foliosDisponiblesCiclo}`);
      logInfo(`Folios totales disponibles: ${result.data.foliosDisponiblesCiclo}`);
      logInfo(`Licencia: ${result.data.licencia}`);
      logInfo(`Ciclo: ${result.data.ciclo} (${result.data.fechaCiclo})`);
      return true;
    } else {
      logError(`Error en conexión: ${result.message}`);
      logInfo(`Código respuesta: ${result.code}`);
      return false;
    }
  } catch (error) {
    logError(`Excepción en test de conexión: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    return false;
  }
}

async function paso2_EnviarFactura(
  config: HKAConfig,
  documento: DocumentoElectronico
): Promise<{ success: boolean; datosDocumento?: DatosDocumento; cufe?: string }> {
  logStep(2, 'Envío de Factura de Prueba');

  try {
    logInfo(`Número de documento: ${documento.datosTransaccion.numeroDocumentoFiscal}`);

    const startTime = Date.now();
    const result = await enviarFactura(config, documento);
    const duration = Date.now() - startTime;

    if (result.success && result.data) {
      logSuccess('Factura enviada y autorizada exitosamente');
      logInfo(`Tiempo de respuesta: ${duration}ms`);
      logInfo(`CUFE: ${result.data.cufe}`);
      logInfo(`QR: ${result.data.qr}`);
      logInfo(`Protocolo: ${result.data.nroProtocoloAutorizacion}`);
      logInfo(`Fecha recepción DGI: ${result.data.fechaRecepcionDGI}`);

      // Retornar datos para siguientes pasos
      return {
        success: true,
        cufe: result.data.cufe,
        datosDocumento: {
          codigoSucursalEmisor: documento.codigoSucursalEmisor,
          numeroDocumentoFiscal: documento.datosTransaccion.numeroDocumentoFiscal,
          puntoFacturacionFiscal: documento.datosTransaccion.puntoFacturacionFiscal,
          tipoDocumento: documento.datosTransaccion.tipoDocumento,
          tipoEmision: documento.datosTransaccion.tipoEmision,
        }
      };
    } else {
      logError(`Error al enviar factura: ${result.message}`);
      logInfo(`Código respuesta: ${result.code}`);
      return { success: false };
    }
  } catch (error) {
    logError(`Excepción al enviar factura: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    return { success: false };
  }
}

async function paso3_ConsultarEstado(
  config: HKAConfig,
  datosDocumento: DatosDocumento
): Promise<boolean> {
  logStep(3, 'Consulta de Estado del Documento');

  try {
    // Esperar 2 segundos antes de consultar
    logInfo('Esperando 2 segundos antes de consultar...');
    await sleep(2000);

    const startTime = Date.now();
    const result = await consultarEstadoDocumento(config, datosDocumento);
    const duration = Date.now() - startTime;

    if (result.success && result.data) {
      logSuccess('Estado consultado exitosamente');
      logInfo(`Tiempo de respuesta: ${duration}ms`);
      logInfo(`Estado: ${result.data.estatusDocumento}`);
      logInfo(`CUFE: ${result.data.cufe}`);
      logInfo(`Fecha emisión: ${result.data.fechaEmisionDocumento}`);
      logInfo(`Mensaje: ${result.data.mensajeDocumento || 'N/A'}`);
      return true;
    } else {
      logError(`Error al consultar estado: ${result.message}`);
      logInfo(`Código respuesta: ${result.code}`);
      return false;
    }
  } catch (error) {
    logError(`Excepción al consultar estado: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    return false;
  }
}

async function paso4_DescargarPDF(
  config: HKAConfig,
  datosDocumento: DatosDocumento
): Promise<boolean> {
  logStep(4, 'Descarga de PDF (Opcional)');

  try {
    // Esperar 3 segundos antes de descargar (HKA necesita tiempo para generar PDF)
    logInfo('Esperando 3 segundos antes de descargar PDF...');
    await sleep(3000);

    const startTime = Date.now();
    const result = await descargarPDF(config, datosDocumento);
    const duration = Date.now() - startTime;

    if (result.success && result.data) {
      logSuccess('PDF descargado exitosamente');
      logInfo(`Tiempo de respuesta: ${duration}ms`);
      logInfo(`Tamaño Base64: ${result.data.documento?.length || 0} caracteres`);

      // Mostrar primeros caracteres del Base64
      if (result.data.documento) {
        logInfo(`Inicio del PDF (Base64): ${result.data.documento.substring(0, 50)}...`);
      }

      return true;
    } else {
      logError(`Error al descargar PDF: ${result.message}`);
      logInfo(`Código respuesta: ${result.code}`);
      logInfo('Nota: Es normal que falle si el PDF aún no está generado. Intente más tarde.');
      return false;
    }
  } catch (error) {
    logError(`Excepción al descargar PDF: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    return false;
  }
}

async function paso5_DescargarXML(
  config: HKAConfig,
  datosDocumento: DatosDocumento
): Promise<boolean> {
  logStep(5, 'Descarga de XML Firmado (Opcional)');

  try {
    const startTime = Date.now();
    const result = await descargarXML(config, datosDocumento);
    const duration = Date.now() - startTime;

    if (result.success && result.data) {
      logSuccess('XML descargado exitosamente');
      logInfo(`Tiempo de respuesta: ${duration}ms`);
      logInfo(`Tamaño Base64: ${result.data.documento?.length || 0} caracteres`);

      // Mostrar primeros caracteres del Base64
      if (result.data.documento) {
        logInfo(`Inicio del XML (Base64): ${result.data.documento.substring(0, 50)}...`);
      }

      return true;
    } else {
      logError(`Error al descargar XML: ${result.message}`);
      logInfo(`Código respuesta: ${result.code}`);
      return false;
    }
  } catch (error) {
    logError(`Excepción al descargar XML: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log();
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(78) + '║');
  console.log('║' + '  TEST E2E: INTEGRACIÓN COMPLETA CON HKA'.padEnd(78) + '║');
  console.log('║' + '  PlentyPay - TheFactoryHKA'.padEnd(78) + '║');
  console.log('║' + ' '.repeat(78) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log();

  // Obtener configuración (de BD o variables de ambiente)
  const config = await getTestConfig();

  console.log(`📋 Ambiente: ${config.environment.toUpperCase()}`);
  console.log(`📋 Punto Facturación: ${config.puntoFacturacionFiscal}`);
  console.log();

  let allSuccess = true;

  // PASO 1: Test de conexión
  const conexionOK = await paso1_TestConexion(config);
  if (!conexionOK) {
    logError('Test de conexión falló. Verifique credenciales y conectividad.');
    process.exit(1);
  }
  allSuccess = allSuccess && conexionOK;

  // PASO 2: Enviar factura
  const envioResult = await paso2_EnviarFactura(config, DOCUMENTO_PRUEBA);
  if (!envioResult.success || !envioResult.datosDocumento) {
    logError('Envío de factura falló. No se pueden ejecutar siguientes pasos.');
    process.exit(1);
  }
  allSuccess = allSuccess && envioResult.success;

  // PASO 3: Consultar estado
  const estadoOK = await paso3_ConsultarEstado(config, envioResult.datosDocumento);
  allSuccess = allSuccess && estadoOK;

  // PASO 4: Descargar PDF (opcional)
  const pdfOK = await paso4_DescargarPDF(config, envioResult.datosDocumento);
  // No afecta allSuccess porque es opcional

  // PASO 5: Descargar XML (opcional)
  const xmlOK = await paso5_DescargarXML(config, envioResult.datosDocumento);
  // No afecta allSuccess porque es opcional

  // Resumen final
  logStep(6, 'Resumen Final');
  console.log(`✅ Paso 1 - Test de Conexión: ${conexionOK ? 'ÉXITO' : 'FALLO'}`);
  console.log(`✅ Paso 2 - Envío de Factura: ${envioResult.success ? 'ÉXITO' : 'FALLO'}`);
  console.log(`✅ Paso 3 - Consulta Estado: ${estadoOK ? 'ÉXITO' : 'FALLO'}`);
  console.log(`${pdfOK ? '✅' : '⚠️ '} Paso 4 - Descarga PDF: ${pdfOK ? 'ÉXITO' : 'FALLO (opcional)'}`);
  console.log(`${xmlOK ? '✅' : '⚠️ '} Paso 5 - Descarga XML: ${xmlOK ? 'ÉXITO' : 'FALLO (opcional)'}`);
  console.log();

  if (allSuccess) {
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(78) + '║');
    console.log('║' + '  🎉 TEST E2E COMPLETADO EXITOSAMENTE 🎉'.padEnd(78) + '║');
    console.log('║' + ' '.repeat(78) + '║');
    console.log('║' + '  La integración con HKA está funcionando correctamente.'.padEnd(78) + '║');
    console.log('║' + '  El sistema está listo para emitir facturas electrónicas.'.padEnd(78) + '║');
    console.log('║' + ' '.repeat(78) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
  } else {
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(78) + '║');
    console.log('║' + '  ❌ TEST E2E FALLÓ ❌'.padEnd(78) + '║');
    console.log('║' + ' '.repeat(78) + '║');
    console.log('║' + '  Revise los errores arriba y corrija antes de continuar.'.padEnd(78) + '║');
    console.log('║' + ' '.repeat(78) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    process.exit(1);
  }
}

// Ejecutar
main().catch(error => {
  console.error();
  logError(`Error fatal: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  console.error(error);
  process.exit(1);
});
