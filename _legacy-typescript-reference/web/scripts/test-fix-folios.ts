/**
 * Test Rápido FoliosRestantes - Verificar que el fix funcione
 * 
 * Este script prueba el método más simple (FoliosRestantes) 
 * para confirmar que el fix del SOAPAction funcionó
 */

import { checkFoliosDisponibles } from '../lib/hka/methods/folios';

// ⚠️ IMPORTANTE: Necesitas un clientId con credenciales HKA configuradas
// Las credenciales se obtienen de client.metadata en la base de datos

const CLIENT_ID = 'TU_CLIENT_ID_AQUI'; // Reemplaza con un clientId real de tu DB

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 TEST POST-FIX: Método FoliosRestantes');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📝 Este test verifica que el fix del SOAPAction funcionó');
console.log(`   ClientID: ${CLIENT_ID}`);
console.log('');

(async () => {
    try {
        console.log('🚀 Llamando a checkFoliosDisponibles...\n');

        const startTime = Date.now();
        const result = await checkFoliosDisponibles(CLIENT_ID);
        const duration = Date.now() - startTime;

        console.log(`⏱️  Tiempo de respuesta: ${duration}ms`);
        console.log('');
        console.log('───────────────────────────────────────────────────────────');
        console.log('📊 RESULTADO:');
        console.log('───────────────────────────────────────────────────────────');
        console.log(JSON.stringify(result, null, 2));
        console.log('');

        if (result.success) {
            console.log('✅ ¡ÉXITO! El método FoliosRestantes funciona correctamente');
            console.log('');
            console.log('📈 Información de Folios:');
            console.log(`   Licencia: ${result.licencia}`);
            console.log(`   Ciclo: ${result.ciclo}`);
            console.log(`   Totales: ${result.foliosTotalesCiclo}`);
            console.log(`   Utilizados: ${result.foliosUtilizadosCiclo}`);
            console.log(`   Disponibles: ${result.foliosDisponiblesCiclo}`);
            console.log(`   Uso: ${result.porcentajeUso}%`);

            if (result.foliosBajos) {
                console.log('   ⚠️  ALERTA: Folios bajos!');
            } else {
                console.log('   ✅ Folios suficientes');
            }

            console.log('');
            console.log('🎉 EL FIX DEL SOAPACTION FUNCIONÓ');
            console.log('   Ahora todos los métodos HKA deberían funcionar correctamente.');

        } else {
            console.log('❌ ERROR en la llamada:');
            console.log(`   ${result.error}`);
            console.log('');
            console.log('🔍 Posibles causas:');
            console.log('   1. ClientID no existe o no tiene credenciales HKA');
            console.log('   2. Credenciales HKA inválidas o expiradas');
            console.log('   3. Problema de conectividad con HKA');
            console.log('   4. Ambiente incorrecto (Demo vs Prod)');
            console.log('');
            console.log('💡 Revisa los logs de HKA para más detalles:');
            console.log('   SELECT * FROM hka_logs ORDER BY timestamp DESC LIMIT 5;');
        }

    } catch (error: any) {
        console.log('❌ EXCEPCIÓN NO MANEJADA:');
        console.log(`   ${error.name}: ${error.message}`);
        console.log('');
        console.log(error.stack);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🏁 FIN DEL TEST');
    console.log('═══════════════════════════════════════════════════════════');
})();

/*
📝 INSTRUCCIONES:

1. Encuentra un clientId con credenciales HKA en tu base de datos:
   
   SELECT id, name 
   FROM "Client" 
   WHERE metadata::jsonb ? 'hka' 
   LIMIT 1;

2. Reemplaza CLIENT_ID arriba con el ID encontrado

3. Ejecuta:
   npx tsx scripts/test-fix-folios.ts

4. Si funciona exitosamente:
   ✅ El fix del SOAPAction está correcto
   ✅ Todos los 9 métodos HKA deberían funcionar ahora

5. Si falla:
   - Revisa que el clientId tenga credenciales válidas
   - Verifica que uses el ambiente correcto (Demo/Prod)
   - Revisa los logs de HKA en la base de datos
*/
