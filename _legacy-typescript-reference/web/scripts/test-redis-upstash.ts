/**
 * scripts/test-redis-upstash.ts
 *
 * Verifica la conexión con Upstash Redis usando el SDK REST (@upstash/redis).
 * Compatible con entornos sin soporte de conexión TCP nativo.
 *
 * Uso: npx tsx scripts/test-redis-upstash.ts
 */

import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

const log = (msg: string, color: keyof typeof COLORS = 'reset') =>
  console.log(`${COLORS[color]}${msg}${COLORS.reset}`);

async function testUpstashConnection() {
  log('\n🧪 Verificando conexión con Upstash Redis (REST API)...', 'cyan');

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    log('❌ Variables de entorno faltantes:', 'red');
    log('   UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN son requeridas.', 'red');
    process.exit(1);
  }

  log(`🔌 Endpoint: ${url}`, 'cyan');

  try {
    const redis = new Redis({ url, token });

    // 1. PING
    log('\n📡 Enviando PING...', 'yellow');
    const pong = await redis.ping();
    if (pong === 'PONG') {
      log('✅ PING → PONG recibido', 'green');
    } else {
      log(`⚠️  Respuesta inesperada al PING: ${pong}`, 'yellow');
    }

    // 2. SET
    const testKey = 'plentypay:test:connection';
    const testValue = `ok-${Date.now()}`;
    log('\n📝 Escribiendo clave de prueba...', 'yellow');
    await redis.set(testKey, testValue, { ex: 60 }); // TTL 60s
    log(`   Clave: ${testKey}`, 'cyan');
    log(`   Valor: ${testValue}`, 'cyan');

    // 3. GET
    log('\n📖 Leyendo clave de prueba...', 'yellow');
    const retrieved = await redis.get<string>(testKey);
    if (retrieved === testValue) {
      log(`✅ Lectura correcta: "${retrieved}"`, 'green');
    } else {
      log(`❌ Valor leído no coincide: "${retrieved}"`, 'red');
      process.exit(1);
    }

    // 4. DEL
    log('\n🗑️  Limpiando clave de prueba...', 'yellow');
    await redis.del(testKey);
    log('✅ Clave eliminada', 'green');

    // 5. INFO
    log('\n📊 Información del servidor:', 'yellow');
    log(`   URL:    ${url}`, 'cyan');
    log(`   Región: us-west-2 (AWS Oregon)`, 'cyan');

    log('\n🎉 ¡Conexión con Upstash Redis verificada exitosamente!\n', 'green');

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`\n❌ Error de conexión: ${message}`, 'red');
    process.exit(1);
  }
}

testUpstashConnection();
