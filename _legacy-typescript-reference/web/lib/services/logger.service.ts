/**
 * Unified Logger Service
 *
 * Sistema unificado de logging para producción que integra:
 * - Pino (structured logging)
 * - Database (ErrorLog persistence)
 * - Request ID correlation
 * - Context enrichment
 *
 * @example
 * ```ts
 * import { logger } from '@/lib/services/logger.service';
 *
 * // Simple log
 * logger.info('Usuario creado', { userId: '123' });
 *
 * // Error log (auto-persisted to DB)
 * try {
 *   await processInvoice(id);
 * } catch (error) {
 *   logger.error('Error procesando factura', error, { invoiceId: id });
 * }
 *
 * // With request context
 * logger.withRequest(request).info('Factura creada');
 * ```
 */

import pino from 'pino';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@core/database';
import type { NextRequest } from 'next/server';
import os from 'os';

// ============================================
// TYPES
// ============================================

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  userId?: string;
  userEmail?: string;
  clientId?: string;
  invoiceId?: string;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface ErrorLogOptions {
  /** Persistir en base de datos */
  persist?: boolean;
  /** Contexto adicional */
  context?: LogContext;
}

// ============================================
// CONFIGURATION
// ============================================

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Configuración de Pino
const pinoConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),

  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },

  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  }),
};

// Logger base de Pino
const pinoLogger = pino(pinoConfig);

// ============================================
// UTILITIES
// ============================================

/**
 * Sanitiza datos sensibles antes de loggear
 */
function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  if (!data) return data;

  const sensitive = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie'];
  const sanitized = { ...data };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitive.some(s => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
      sanitized[key] = sanitizeData(sanitized[key] as Record<string, unknown>);
    }
  }

  return sanitized;
}

/**
 * Trunca strings largos
 */
function truncate(str: string | undefined, maxLength: number = 5000): string | undefined {
  if (!str) return str;
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '... [truncated]';
}

/**
 * Extrae información del request
 */
function extractRequestInfo(request?: NextRequest | Request): Partial<LogContext> {
  if (!request) return {};

  return {
    method: request.method,
    path: 'nextUrl' in request ? request.nextUrl.pathname : new URL(request.url).pathname,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
  };
}

/**
 * Obtiene Request ID del header o genera uno nuevo
 */
function getOrGenerateRequestId(request?: NextRequest | Request): string {
  if (request) {
    const existingId = request.headers.get('x-request-id');
    if (existingId) return existingId;
  }

  // Generar ID único
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

// ============================================
// LOGGER CLASS
// ============================================

class UnifiedLogger {
  private context: LogContext = {};

  /**
   * Añade contexto al logger (inmutable, retorna nueva instancia)
   */
  withContext(context: LogContext): UnifiedLogger {
    const newLogger = new UnifiedLogger();
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  /**
   * Añade contexto desde un Request
   */
  withRequest(request: NextRequest | Request): UnifiedLogger {
    const requestInfo = extractRequestInfo(request);
    const requestId = getOrGenerateRequestId(request);
    return this.withContext({ ...requestInfo, requestId });
  }

  /**
   * Log genérico
   */
  log(level: LogLevel, message: string, context?: LogContext): void {
    const mergedContext = { ...this.context, ...context };
    const sanitized = sanitizeData(mergedContext);

    pinoLogger[level]({ ...sanitized }, message);
  }

  /**
   * Log nivel TRACE
   */
  trace(message: string, context?: LogContext): void {
    this.log('trace', message, context);
  }

  /**
   * Log nivel DEBUG
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log nivel INFO
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log nivel WARN
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);

    // Register as breadcrumb so Sentry attaches context to subsequent errors
    Sentry.addBreadcrumb({
      category: (this.context as Record<string, string>).module ?? 'app',
      message,
      level: 'warning',
      data: sanitizeData({ ...this.context, ...context }),
    });
  }

  /**
   * Log nivel ERROR con persistencia en DB
   */
  async error(
    message: string,
    error?: Error | unknown,
    options: ErrorLogOptions = {}
  ): Promise<void> {
    const {
      persist = isProduction,
      context = {},
    } = options;

    const mergedContext = { ...this.context, ...context };
    const sanitized = sanitizeData(mergedContext);

    // Extraer información del error
    const errorInfo = this.extractErrorInfo(error);

    // Log en Pino
    pinoLogger.error(
      {
        ...sanitized,
        error: errorInfo,
      },
      message
    );

    // ── Report to Sentry ────────────────────────────────────
    const sentryError = error instanceof Error ? error : new Error(errorInfo.message);
    Sentry.withScope((scope) => {
      scope.setLevel('error');
      if (mergedContext.module)    scope.setTag('module', mergedContext.module as string);
      if (mergedContext.clientId)  scope.setTag('company_id', mergedContext.clientId);
      if (mergedContext.userId)    scope.setUser({ id: mergedContext.userId, email: mergedContext.userEmail as string | undefined });
      if (mergedContext.requestId) scope.setTag('request_id', mergedContext.requestId);
      if (mergedContext.path)      scope.setTag('path', mergedContext.path);
      scope.setContext('logger_context', sanitizeData(mergedContext));
      Sentry.captureException(sentryError);
    });

    // Persistir en DB
    if (persist) {
      await this.persistErrorLog(message, errorInfo, mergedContext);
    }
  }

  /**
   * Log nivel FATAL
   */
  async fatal(
    message: string,
    error?: Error | unknown,
    context?: LogContext
  ): Promise<void> {
    await this.error(message, error, {
      context,
      persist: true,
    });
  }

  /**
   * Extrae información estructurada del error
   */
  private extractErrorInfo(error: unknown): {
    type: string;
    message: string;
    code?: string;
    stack?: string;
  } {
    if (!error) {
      return {
        type: 'UnknownError',
        message: 'No error provided',
      };
    }

    if (error instanceof Error) {
      return {
        type: error.name || error.constructor.name,
        message: error.message,
        code: (error as Error & { code?: string }).code || undefined,
        stack: error.stack,
      };
    }

    // Si no es Error, convertir a string
    return {
      type: typeof error,
      message: String(error),
    };
  }

  /**
   * Persiste error en base de datos
   */
  private async persistErrorLog(
    message: string,
    errorInfo: ReturnType<typeof this.extractErrorInfo>,
    context: LogContext
  ): Promise<void> {
    try {
      await prisma.errorLog.create({
        data: {
          requestId: context.requestId,
          method: context.method,
          path: context.path,
          endpoint: context.path,

          // User
          userId: context.userId,
          userEmail: context.userEmail,

          // Organization
          clientId: context.clientId as string,

          // Error
          errorType: errorInfo.type,
          errorMessage: truncate(errorInfo.message, 5000) as string,
          errorCode: errorInfo.code,
          errorStack: truncate(errorInfo.stack, 10000) as string,

          // Request data
          requestBody: context.requestBody ? truncate(JSON.stringify(context.requestBody), 5000) : undefined,
          requestQuery: context.requestQuery as any,
          requestHeaders: context.requestHeaders ? sanitizeData(context.requestHeaders as Record<string, unknown>) : undefined,

          // Technical
          ip: context.ip,
          userAgent: truncate(context.userAgent, 500),
          duration: context.duration,

          // Environment
          environment: process.env.NODE_ENV,
          hostname: os.hostname(),
          version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version,

          // Metadata
          metadata: sanitizeData(context),
        },
      });
    } catch (dbError) {
      // Si falla el guardado en DB, solo loggear pero no fallar la operación original
      pinoLogger.error({ error: dbError }, 'Failed to persist error log to database');
    }
  }
}

// ============================================
// EXPORTS
// ============================================

/**
 * Logger global singleton
 */
export const logger = new UnifiedLogger();

/**
 * Crea un logger con contexto específico
 */
export function createLogger(context: LogContext): UnifiedLogger {
  return logger.withContext(context);
}

/**
 * Helpers para contextos comunes
 */
export const loggers = {
  /** Logger para operaciones de HKA */
  hka: createLogger({ module: 'HKA' }),

  /** Logger para procesamiento de facturas */
  invoice: createLogger({ module: 'Invoice' }),

  /** Logger para autenticación */
  auth: createLogger({ module: 'Auth' }),

  /** Logger para API */
  api: createLogger({ module: 'API' }),

  /** Logger para workers */
  worker: createLogger({ module: 'Worker' }),

  /** Logger para cron jobs */
  cron: createLogger({ module: 'Cron' }),
};

/**
 * Middleware helper: Loggea requests automáticamente
 */
export async function logRequest(
  request: NextRequest | Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const startTime = Date.now();
  const requestId = getOrGenerateRequestId(request);
  const requestInfo = extractRequestInfo(request);

  const requestLogger = logger.withContext({
    ...requestInfo,
    requestId,
  });

  requestLogger.info('Request received');

  try {
    const response = await handler();
    const duration = Date.now() - startTime;

    requestLogger.info('Request completed', {
      statusCode: response.status,
      duration,
    });

    return response;
  } catch (error) {
    const duration = Date.now() - startTime;

    await requestLogger.error('Request failed', error, {
      context: { duration },
    });

    throw error;
  }
}

export default logger;
