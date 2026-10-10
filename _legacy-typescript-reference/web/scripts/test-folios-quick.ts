#!/usr/bin/env ts-node

/**
 * Script de prueba rápida para verificar si las comillas en SOAPAction causan problemas
 * 
 * USO:
 * 1. Reemplaza CLIENT_ID con un ID real de cliente con HKA configurado
 * 2. Ejecuta: npx tsx scripts/test-folios-quick.ts
 */

import { checkFoliosDisponibles } from '../lib/hka/methods/folios';

// ⚠️ REEMPLAZA ESTE ID CON UN CLIENT_ID REAL
const CLIENT_ID = process.env.TEST_CLIENT_ID || 'REEMPLAZA_CON_CLIENT_ID_REAL';

async function testFolios() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 TEST RÁPIDO: Consulta de Folios');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`📋 ClientID: ${CLIENT_ID}\n`);

    if (CLIENT_ID === 'REEMPLAZA_CON_CLIENT_ID_REAL') {
        console.error('❌ ERROR: Debes reemplazar CLIENT_ID con un ID real');
        console.error('   Edita el archivo y coloca un clientId válido en la línea 15');
        console.error('   O ejecuta: TEST_CLIENT_ID=tu-client-id npx tsx scripts/test-folios-quick.ts');
        process.exit(1);
    }

    try {
        console.log('🚀 Llamando a checkFoliosDisponibles...\n');

        const startTime = Date.now();
        const result = await checkFoliosDisponibles(CLIENT_ID);
        const duration = Date.now() - startTime;

        console.log(`⏱️  Tiempo de respuesta: ${duration}ms\n`);

        console.log('───────────────────────────────────────────────────────────');
        console.log('📊 RESULTADO:');
        console.log('───────────────────────────────────────────────────────────');
        console.log(JSON.stringify(result, null, 2));
        console.log('');

        if (result.success) {
            console.log('✅ ¡ÉXITO! El método FoliosRestantes funciona correctamente\n');
            console.log('📈 Información de Folios:');
            console.log(`   Licencia: ${result.licencia}`);
            console.log(`   Ciclo: ${result.ciclo}`);
            console.log(`   Totales: ${result.foliosTotalesCiclo}`);
            console.log(`   Utilizados: ${result.foliosUtilizadosCiclo}`);
            console.log(`   Disponibles: ${result.foliosDisponiblesCiclo}`);
            console.log(`   Porcentaje de uso: ${result.porcentajeUso}%`);

            if (result.foliosBajos) {
                console.log('   ⚠️  ALERTA: Folios bajos!');
            } else {
                console.log('   ✅ Folios suficientes');
            }

            console.log('');
            console.log('🎉 ¡LAS MEJORAS FUNCIONAN CORRECTAMENTE!');
            console.log('   - SOAPAction con comillas: ✅');
            console.log('   - Retry logic: ✅ (si hubo reintentos, verás logs de WARN)');
            console.log('   - Headers adicionales: ✅');

        } else {
            console.log('❌ ERROR en la llamada:');
            console.log(`   ${result.error}\n`);

            console.log('🔍 Posible causa del error:\n');

            if (result.error?.includes('comillas') || result.error?.includes('SOAPAction')) {
                console.log('   ⚠️  Problema con el header SOAPAction');
                console.log('   📝 SOLUCIÓN: Revertir las comillas en getSOAPAction()');
                console.log('   El servidor HKA podría no aceptar comillas dobles.');
            } else if (result.error?.includes('token') || result.error?.includes('auth')) {
                console.log('   🔑 Problema de autenticación');
                console.log('   Verifica las credenciales HKA del cliente');
            } else if (result.error?.includes('timeout')) {
                console.log('   ⏱️  Timeout - El servidor tardó mucho en responder');
                console.log('   Esto podría indicar problemas de red o servidor');
            } else if (result.error?.includes('network') || result.error?.includes('fetch')) {
                console.log('   🌐 Problema de red');
                console.log('   Verifica la conectividad con HKA');
            } else {
                console.log('   ❓ Error desconocido');
                console.log('   Revisa los logs de HKA en la base de datos:');
                console.log('   SELECT * FROM hka_logs ORDER BY timestamp DESC LIMIT 5;');
            }
        }

    } catch (error: any) {
        console.log('\n❌ EXCEPCIÓN NO MANEJADA:');
        console.log(`   Tipo: ${error.name}`);
        console.log(`   Mensaje: ${error.message}\n`);

        if (error.message?.includes('Client') || error.message?.includes('encontrado')) {
            console.log('💡 El clientId proporcionado no existe en la base de datos');
            console.log('   Verifica que el ID sea correcto:');
            console.log('   SELECT id, name FROM "Client" LIMIT 10;');
        } else if (error.message?.includes('HKA no está habilitado')) {
            console.log('💡 HKA no está habilitado para este cliente');
            console.log('   Habilítalo en: UPDATE "Client" SET "hkaEnabled" = true WHERE id = \'...\';');
        } else if (error.message?.includes('credenciales')) {
            console.log('💡 Faltan credenciales HKA');
            console.log('   Configúralas en la tabla Client (hkaTokenUser, hkaTokenPassword)');
        }

        console.log('\n📚 Stack trace completo:');
        console.log(error.stack);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🏁 FIN DEL TEST');
    console.log('═══════════════════════════════════════════════════════════');
}

// Ejecutar
testFolios().catch(console.error);
