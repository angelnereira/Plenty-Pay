const { URL } = require('url');

/**
 * script: verify-env.js
 * 
 * Este script se ejecuta antes del build para asegurar que las variables de entorno
 * críticas estén configuradas correctamente y coincidan con el entorno de despliegue.
 * 
 * Reglas:
 * 1. Si VERCEL_ENV es 'production', DATABASE_URL debe apuntar a la base de datos de producción.
 * 2. En cualquier otro entorno (Development/preview, Hotfix, previews, local),
 *    DATABASE_URL NO puede apuntar a producción (el build falla).
 *    Opcionalmente, EXPECTED_DEV_DB_HOST exige un endpoint concreto de desarrollo.
 */

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(message, color = RESET) {
    console.log(`${color}${message}${RESET}`);
}

function verify() {
    log('🔒 Verificando Aislamiento de Entornos...', YELLOW);

    const env = process.env.VERCEL_ENV || 'development';
    const branch = process.env.VERCEL_GIT_COMMIT_REF || 'local';
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        log('❌ Error: DATABASE_URL no está definida.', RED);
        process.exit(1);
    }

    // Parsear la URL de la base de datos para obtener el host
    let dbHost;
    try {
        const parsedUrl = new URL(dbUrl);
        dbHost = parsedUrl.hostname;
    } catch (e) {
        log('❌ Error: DATABASE_URL no es una URL válida.', RED);
        process.exit(1);
    }

    log(`ℹ️  Entorno Detected: ${env}`);
    log(`ℹ️  Rama Git: ${branch}`);
    log(`ℹ️  DB Host: ${dbHost}`);

    // Definir los hosts esperados (IDs de los endpoints de Neon)
    const PROD_HOST_ID = 'ep-lingering-band';
    // Endpoint esperado para Development/preview (opcional). Si se define,
    // se exige coincidencia exacta en entornos no productivos.
    const DEV_HOST_ID = process.env.EXPECTED_DEV_DB_HOST || '';

    // REGLA 1: Producción
    if (env === 'production') {
        if (!dbHost.includes(PROD_HOST_ID)) {
            log(`❌ PELIGRO CRÍTICO: Estás en PRODUCCIÓN pero la DATABASE_URL no parece ser de producción.`, RED);
            log(`   Esperado host que contenga: ${PROD_HOST_ID}`, RED);
            log(`   Recibido: ${dbHost}`, RED);
            process.exit(1);
        }
        log('✅ Verificación de Producción: OK', GREEN);
    }
    // REGLA 2: Cualquier entorno NO productivo (Development/preview, Hotfix,
    // previews de PRs, desarrollo local). La base de datos de producción está
    // PROHIBIDA fuera de producción: el build falla para proteger los datos.
    else {
        if (dbHost.includes(PROD_HOST_ID)) {
            log(`❌ PELIGRO CRÍTICO: Entorno NO productivo (${env} / rama ${branch}) apuntando a la base de datos de PRODUCCIÓN.`, RED);
            log(`   Host recibido: ${dbHost}`, RED);
            log(`   Configura DATABASE_URL (scope Preview) con la rama Neon de desarrollo.`, RED);
            process.exit(1);
        }
        if (DEV_HOST_ID && !dbHost.includes(DEV_HOST_ID)) {
            log(`❌ PELIGRO: La DATABASE_URL no coincide con el endpoint esperado de desarrollo.`, RED);
            log(`   Esperado host que contenga: ${DEV_HOST_ID}`, RED);
            log(`   Recibido: ${dbHost}`, RED);
            process.exit(1);
        }
        log('✅ Verificación de Desarrollo/Preview: OK (aislado de producción)', GREEN);
    }

    log('🔒 Verificación de Entorno Completada Exitosamente.', GREEN);
}

verify();
