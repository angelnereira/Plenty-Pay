/**
 * Script de debugging para diagnosticar problemas con el cliente SOAP
 *
 * Ejecutar: npx tsx lib/features/hka/scripts/debug-soap-client.ts
 */

import { getHKASoapClient } from '../services/hka-soap-client.service';
import type { HKAConfig } from '../types/types';

async function debugSoapClient() {
  console.log('🔍 Iniciando diagnóstico del cliente SOAP HKA\n');

  // Configuración de prueba con DEMO
  const config: HKAConfig = {
    tokenEmpresa: 'TEST_TOKEN', // Token de prueba
    tokenPassword: 'TEST_PASSWORD', // Password de prueba
    environment: 'demo',
    branchCode: '001',
    puntoFacturacionFiscal: '001',
  } as any;

  try {
    console.log('📡 Paso 1: Intentando crear cliente SOAP...');
    console.log(`   Endpoint: https://demoemision.thefactoryhka.com.pa/ws/obj/v1.0/Service.svc`);
    console.log('');

    const startTime = Date.now();
    const client = await getHKASoapClient(config);
    const duration = Date.now() - startTime;

    console.log(`✅ Cliente SOAP creado exitosamente en ${duration}ms`);
    console.log('');

    console.log('📋 Paso 2: Inspeccionando servicios disponibles...');
    const description = client.describe();

    console.log('');
    console.log('📦 Servicios encontrados:');
    console.log(JSON.stringify(description, null, 2));
    console.log('');

    // Listar métodos disponibles
    console.log('🔧 Métodos disponibles en el cliente:');
    const methods = Object.keys(description)
      .flatMap(serviceName =>
        Object.keys(description[serviceName])
          .flatMap(portName =>
            Object.keys(description[serviceName][portName])
          )
      );

    methods.forEach(method => {
      console.log(`   - ${method}`);
    });
    console.log('');

    // Verificar métodos específicos que necesitamos
    const requiredMethods = [
      'Enviar',
      'EstadoDocumento',
      'FoliosRestantes',
      'ConsultarRucDV',
      'DescargarAcusePDF',
      'DescargarXML',
      'RastreoCorreo',
      'EventoDocumento',
      'ListadoDocumentos'
    ];

    console.log('✅ Verificando métodos requeridos:');
    requiredMethods.forEach(method => {
      const asyncMethod = `${method}Async`;
      const available = typeof (client as any)[asyncMethod] === 'function';
      const status = available ? '✅' : '❌';
      console.log(`   ${status} ${method} (${asyncMethod})`);
    });
    console.log('');

    console.log('🎉 Diagnóstico completado exitosamente');
    console.log('');
    console.log('💡 El cliente SOAP está funcionando correctamente.');
    console.log('   Si hay errores al consultar folios, probablemente sean:');
    console.log('   1. Credenciales inválidas (tokenEmpresa/tokenPassword)');
    console.log('   2. Problema de conectividad de red');
    console.log('   3. El servicio HKA no está disponible');
    console.log('');

  } catch (error) {
    console.error('❌ Error al crear cliente SOAP:');
    console.error('');

    if (error instanceof Error) {
      console.error(`   Mensaje: ${error.message}`);
      console.error('');
      if (error.stack) {
        console.error('   Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(`   Error desconocido: ${JSON.stringify(error)}`);
    }

    console.error('');
    console.error('🔍 Posibles causas:');
    console.error('   1. El endpoint no responde o no está disponible');
    console.error('   2. Problema con el WSDL (no se puede leer)');
    console.error('   3. Timeout de conexión');
    console.error('   4. Problema de DNS/red');
    console.error('   5. El package soap tiene un problema');
    console.error('');

    process.exit(1);
  }
}

// Ejecutar
debugSoapClient().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
