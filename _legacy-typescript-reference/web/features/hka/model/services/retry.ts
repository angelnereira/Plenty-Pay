/**
 * HKA Retry Logic System
 * Sistema de reintentos con exponential backoff
 *
 * Características:
 * - Exponential backoff (1s, 2s, 4s, 8s...)
 * - Solo reintenta errores recuperables
 * - Logging de cada intento
 * - Configuración flexible
 */

import { HKAError, HKAErrorType } from './errors';
import { HKALogger } from './logger';

/**
 * Configuración de reintentos
 */
export interface RetryConfig {
  /** Número máximo de intentos (incluye el intento inicial) */
  maxAttempts: number;

  /** Delay inicial en ms */
  initialDelayMs: number;

  /** Delay máximo en ms */
  maxDelayMs: number;

  /** Multiplicador para exponential backoff */
  backoffMultiplier: number;

  /** Función custom para determinar si reintentar (opcional) */
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Configuración por defecto
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 segundo
  maxDelayMs: 10000,    // 10 segundos
  backoffMultiplier: 2, // Duplicar en cada intento
};

/**
 * Contexto para logging de reintentos
 */
export interface RetryContext {
  /** Método HKA que se está ejecutando */
  method: string;

  /** ID de factura (opcional) */
  invoiceId?: string;

  /** ID de cliente (opcional) */
  clientId?: string;

  /** Metadata adicional */
  metadata?: Record<string, unknown>;
}

/**
 * Resultado de una operación con reintentos
 */
export interface RetryResult<T> {
  /** Resultado de la operación */
  result: T;

  /** Número de intentos realizados */
  attempts: number;

  /** Duración total en ms */
  totalDuration: number;

  /** Si hubo reintentos */
  hadRetries: boolean;
}

/**
 * Ejecuta una operación con retry logic y exponential backoff
 *
 * @param operation - Función asíncrona a ejecutar
 * @param config - Configuración de reintentos
 * @param logger - Instancia de HKALogger (opcional)
 * @param context - Contexto para logging
 * @returns Resultado de la operación
 * @throws El último error si se agotan los reintentos
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => {
 *     const res = await emitirFactura(clientId, invoice);
 *     if (!res.success) {
 *       throw parseHKAError(res.code, res.error);
 *     }
 *     return res;
 *   },
 *   { maxAttempts: 3 },
 *   logger,
 *   { method: 'Enviar', invoiceId: '123' }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  logger?: HKALogger,
  context?: RetryContext
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      // Log intento (si no es el primero)
      if (logger && attempt > 1) {
        await logger.log({
          level: 'INFO',
          method: context?.method || 'unknown',
          invoiceId: context?.invoiceId,
          clientId: context?.clientId,
          timestamp: new Date(),
          metadata: {
            attempt,
            maxAttempts: cfg.maxAttempts,
            message: `Reintentando operación (intento ${attempt}/${cfg.maxAttempts})`,
            ...context?.metadata,
          },
        });
      }

      // Ejecutar operación
      const result = await operation();

      // Éxito - log si hubo reintentos
      if (logger && attempt > 1) {
        await logger.log({
          level: 'INFO',
          method: context?.method || 'unknown',
          invoiceId: context?.invoiceId,
          clientId: context?.clientId,
          timestamp: new Date(),
          metadata: {
            attempt,
            totalAttempts: attempt,
            message: `Operación exitosa después de ${attempt} intento(s)`,
            ...context?.metadata,
          },
        });
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Determinar si debemos reintentar
      const shouldRetry = cfg.shouldRetry
        ? cfg.shouldRetry(lastError, attempt)
        : shouldRetryError(lastError);

      // Si no es recuperable, lanzar inmediatamente
      if (!shouldRetry) {
        if (logger) {
          await logger.log({
            level: 'ERROR',
            method: context?.method || 'unknown',
            invoiceId: context?.invoiceId,
            clientId: context?.clientId,
            timestamp: new Date(),
            error: {
              type: lastError.name,
              message: lastError.message,
              stack: lastError.stack,
              recoverable: false,
            },
            metadata: {
              attempt,
              message: 'Error no recuperable - no se reintentará',
              ...context?.metadata,
            },
          });
        }
        throw lastError;
      }

      // Si es el último intento, lanzar error
      if (attempt === cfg.maxAttempts) {
        if (logger) {
          await logger.log({
            level: 'ERROR',
            method: context?.method || 'unknown',
            invoiceId: context?.invoiceId,
            clientId: context?.clientId,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            error: {
              type: lastError.name,
              message: lastError.message,
              stack: lastError.stack,
              recoverable: true,
            },
            metadata: {
              attempt,
              maxAttempts: cfg.maxAttempts,
              retriesExhausted: true,
              message: `Se agotaron los reintentos (${cfg.maxAttempts} intentos)`,
              ...context?.metadata,
            },
          });
        }
        throw lastError;
      }

      // Calcular delay con exponential backoff
      const delay = calculateDelay(attempt, cfg);

      // Log del error y próximo reintento
      if (logger) {
        await logger.log({
          level: 'WARN',
          method: context?.method || 'unknown',
          invoiceId: context?.invoiceId,
          clientId: context?.clientId,
          timestamp: new Date(),
          error: {
            type: lastError.name,
            message: lastError.message,
            recoverable: true,
          },
          metadata: {
            attempt,
            maxAttempts: cfg.maxAttempts,
            retryingIn: delay,
            message: `Error recuperable - reintentando en ${delay}ms`,
            ...context?.metadata,
          },
        });
      }

      // Esperar antes del próximo intento
      await sleep(delay);
    }
  }

  // No debería llegar aquí, pero por si acaso
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Versión simplificada de retry sin logging
 */
export async function retrySimple<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retryWithBackoff(operation, { maxAttempts });
}

/**
 * Determina si un error debe ser reintentado
 */
function shouldRetryError(error: Error): boolean {
  // Si es un HKAError, usar su flag de recoverable
  if (error instanceof HKAError) {
    return error.recoverable;
  }

  // Errores genéricos que son recuperables
  const recoverablePatterns = [
    /timeout/i,
    /timed out/i,
    /network/i,
    /econnrefused/i,
    /fetch failed/i,
    /503/,
    /service unavailable/i,
  ];

  return recoverablePatterns.some(pattern =>
    pattern.test(error.message)
  );
}

/**
 * Calcula el delay para el próximo intento usando exponential backoff
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt-1)
  // Intento 1: error → delay para intento 2
  // Intento 2: error → delay para intento 3
  const exponentialDelay = config.initialDelayMs * Math.pow(
    config.backoffMultiplier,
    attempt - 1
  );

  // Aplicar máximo
  return Math.min(exponentialDelay, config.maxDelayMs);
}

/**
 * Helper para dormir por N milisegundos
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Envuelve una operación con retry y devuelve metadata del proceso
 */
export async function retryWithMetadata<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  logger?: HKALogger,
  context?: RetryContext
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  const wrappedOperation = async () => {
    attempts++;
    return await operation();
  };

  const result = await retryWithBackoff(wrappedOperation, config, logger, context);

  return {
    result,
    attempts,
    totalDuration: Date.now() - startTime,
    hadRetries: attempts > 1,
  };
}

/**
 * Configuración de retry específica para diferentes operaciones HKA
 */
export const RETRY_CONFIGS = {
  /** Emisión de facturas - crítico, reintentar agresivamente */
  ENVIAR: {
    maxAttempts: 3,
    initialDelayMs: 2000, // 2s, 4s, 8s
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  } as RetryConfig,

  /** Consultas - menos crítico, reintentar rápido */
  CONSULTA: {
    maxAttempts: 2,
    initialDelayMs: 500, // 500ms, 1s
    maxDelayMs: 2000,
    backoffMultiplier: 2,
  } as RetryConfig,

  /** Descargas - pueden fallar, reintentar con paciencia */
  DESCARGA: {
    maxAttempts: 3,
    initialDelayMs: 1000, // 1s, 2s, 4s
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  } as RetryConfig,

  /** Envío de correo - no crítico, pocos reintentos */
  EMAIL: {
    maxAttempts: 2,
    initialDelayMs: 1000,
    maxDelayMs: 3000,
    backoffMultiplier: 2,
  } as RetryConfig,
};
