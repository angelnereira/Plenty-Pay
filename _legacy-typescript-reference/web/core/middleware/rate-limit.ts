/**
 * Rate Limiting con Upstash Redis
 * 
 * Protege endpoints contra abuso y ataques DoS
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Configuración de Redis desde variables de entorno
const getRedisClient = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url?.startsWith('http') && token) {
    return new Redis({
      url,
      token,
    });
  }

  // Fallback seguro para build/dev
  console.warn('⚠️ Redis URL no válida o falta token (se requiere Upstash REST para Rate Limiting). Entorno:', process.env.NODE_ENV);
  
  // Utilizar mock para evitar crash en build sin variables de entorno
  return new Redis({
    url: 'https://dummy.upstash.io',
    token: 'dummy',
  });
};

const redis = getRedisClient();

const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'dev';

/**
 * Rate limiters por tipo de operación
 *
 * `analytics: false` a propósito: en el free tier de Upstash (500K comandos/día,
 * 256MB) la analítica duplica los comandos por chequeo y acumula hashes. Los
 * límites se siguen aplicando igual; solo se omiten los datos del dashboard.
 */
export const rateLimiters = {
  // API general: 100 requests/minuto por IP
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: false,
    prefix: `ratelimit:${env}:api`,
  }),

  // Creación de facturas: 20 requests/minuto por organización
  invoiceCreate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    analytics: false,
    prefix: `ratelimit:${env}:invoice`,
  }),

  // Envío a HKA: 10 requests/minuto (límite HKA recomendado)
  hkaSend: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: false,
    prefix: `ratelimit:${env}:hka`,
  }),

  // Login: 5 intentos cada 15 minutos
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '15 m'),
    analytics: false,
    prefix: `ratelimit:${env}:auth`,
  }),

  // Signup: 3 registros por hora por IP
  signup: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '1 h'),
    analytics: false,
    prefix: `ratelimit:${env}:signup`,
  }),

  // Password Reset: 3 solicitudes cada 15 minutos por IP
  passwordReset: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '15 m'),
    analytics: true,
    prefix: `ratelimit:${env}:password-reset`,
  }),

  // Tracking público: 30 consultas por minuto por IP
  logisticsTrack: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: false,
    prefix: `ratelimit:${env}:logistics:track`,
  }),
};

/**
 * Verificar rate limit
 * 
 * @param limiter - Rate limiter a usar
 * @param identifier - Identificador único (IP, userId, etc.)
 * @returns Objeto con información del rate limit
 * @throws RateLimitError si se excede el límite
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ limit: number; reset: Date; remaining: number }> {
  try {
    const { success, limit, reset, remaining } = await limiter.limit(identifier);

    if (!success) {
      throw new RateLimitError({
        limit,
        reset: new Date(reset),
        remaining: 0,
      });
    }

    return { limit, reset: new Date(reset), remaining };
  } catch (error) {
    // Si es un error de RateLimit (obtenido arriba), lo relanzamos
    if (error instanceof RateLimitError) {
      throw error;
    }

    // Si es error de infraestructura (Redis caído, url inválida, etc),
    // aplicamos "Fail Open": permitir la petición y loguear el error.
    console.error('[RateLimit] Error checking limit. Allowing request.', error);

    // Retornamos valores dummy para continuar
    return {
      limit: 100,
      reset: new Date(Date.now() + 60000),
      remaining: 99
    };
  }
}

/**
 * Error de Rate Limit
 */
export class RateLimitError extends Error {
  constructor(public details: {
    limit: number;
    reset: Date;
    remaining: number;
  }) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }

  /**
   * Obtener headers HTTP para respuesta de rate limit
   */
  toHeaders(): Record<string, string> {
    const retryAfter = Math.ceil((this.details.reset.getTime() - Date.now()) / 1000);

    return {
      'X-RateLimit-Limit': this.details.limit.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': this.details.reset.toISOString(),
      'Retry-After': retryAfter.toString(),
    };
  }
}

