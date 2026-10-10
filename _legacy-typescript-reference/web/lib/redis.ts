/**
 * lib/redis.ts
 *
 * Cliente Upstash Redis para PlentyPay.
 *
 * Usa HTTP REST API (no TCP) para ser compatible con:
 *   - Vercel Edge Runtime (middleware.ts)
 *   - Vercel Serverless Functions (API routes)
 *   - Node.js tradicional (bg-worker, scripts)
 *
 * Parámetros requeridos en .env.local:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';

// --- Singleton -----------------------------------------------------------
// Upstash Redis se inicializa una vez y se reutiliza en toda la aplicación.
// El SDK lee automáticamente las variables de entorno si se llama a fromEnv().
function createRedisClient(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL || 'https://dummy-url.upstash.io';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || 'dummy-token';

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn(
      '[Redis] ADVERTENCIA: Variables de entorno faltantes: ' +
        'UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN. Se usará un cliente dummy (esto es normal durante el build).'
    );
  }

  return new Redis({ url, token });
}

// Patrón singleton seguro para HMR en desarrollo (Next.js)
declare global {
  var __redis: Redis | undefined;
}

export const redis: Redis =
  globalThis.__redis ?? (globalThis.__redis = createRedisClient());

// -------------------------------------------------------------------------
// Helpers tipados para facilitar el uso en toda la app
// -------------------------------------------------------------------------

/**
 * Obtiene un valor de Redis.
 * Retorna null si la clave no existe.
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

/**
 * Persiste un valor en Redis con TTL opcional (en segundos).
 */
export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds?: number
): Promise<void> {
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, value);
  } else {
    await redis.set(key, value);
  }
}

/**
 * Elimina una clave de Redis.
 */
export async function redisDel(key: string): Promise<void> {
  await redis.del(key);
}

/**
 * Incrementa un contador atómico y retorna el nuevo valor.
 * Útil para rate-limiting manual o estadísticas.
 */
export async function redisIncr(key: string): Promise<number> {
  return redis.incr(key);
}

/**
 * Asigna TTL a una clave existente (en segundos).
 */
export async function redisExpire(key: string, ttlSeconds: number): Promise<void> {
  await redis.expire(key, ttlSeconds);
}
