/**
 * Logger profesional con Pino
 * 
 * Reemplaza console.log con sistema de logging estructurado
 * Configuración por entorno (dev vs prod)
 */

import pino from 'pino';

// Configuración base del logger
const loggerConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',

  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },

  // Timestamps en UTC
  timestamp: () => `,"time":"${new Date().toISOString()}"`,

  // Message format
  messageKey: 'msg',



  // 🔒 SEGURIDAD: Redactar campos sensibles automáticamente
  redact: {
    paths: [
      // Credenciales generales
      'token',
      'password',
      'secret',
      'authorization',
      'apiKey',
      'api_key',
      // Tokens HKA específicos
      'tokenEmpresa',
      'tokenPassword',
      'tokenUser',
      'hkaToken',
      'hkaTokenPassword',
      // Headers sensibles
      'headers.authorization',
      'headers.cookie',
      'headers["x-api-key"]',
      // Nested tokens
      '*.token',
      '*.password',
      '*.secret',
      '*.tokenEmpresa',
      '*.tokenPassword',
      '*.authorization',
      // Query params
      'query.token',
      'query.password',
      'query.secret',
    ],
    remove: true, // Eliminar completamente en lugar de mostrar [Redacted]
  },

  // Serializers para errores
  serializers: {
    error: pino.stdSerializers.err,
  },
};

// Configuración especial para desarrollo
const isDevelopment = process.env.NODE_ENV === 'development';

const finalConfig: pino.LoggerOptions = isDevelopment
  ? {
    ...loggerConfig,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  }
  : loggerConfig;

// Crear instancia principal del logger
export const logger = (pino as any)(finalConfig);

/**
 * Crear logger con contexto (para sub-módulos)
 * 
 * @param context - Contexto del logger (ej: 'HKA-SOAP', 'Invoice-Processor')
 * @returns Logger configurado con contexto
 * 
 * @example
 * const hkaLogger = createLogger('HKA-SOAP');
 * hkaLogger.info('Enviando documento a HKA');
 * // Output: [HKA-SOAP] Enviando documento a HKA
 */
export function createLogger(context: string): pino.Logger {
  return logger.child({ context });
}

/**
 * Logger pre-configurado para módulos principales
 */
export const loggers = {
  hka: createLogger('HKA'),
  hkaSOAP: createLogger('HKA-SOAP'),
  worker: createLogger('Worker'),
  invoiceProcessor: createLogger('Invoice-Processor'),
  queue: createLogger('Queue'),
  auth: createLogger('Auth'),
  api: createLogger('API'),
};

/**
 * Helper para logging de requests HTTP
 */
export function logRequest(method: string, path: string, statusCode: number, duration: number) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  logger[level]({
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
  });
}

/**
 * Helper para logging de errores con contexto
 */
export function logError(error: unknown, context?: Record<string, any>) {
  logger.error({
    err: error,
    ...context,
  });
}

/**
 * Helper para logging de transacciones (ej: procesamiento de facturas)
 */
export function logTransaction(
  action: string,
  entityId: string,
  status: 'success' | 'error',
  metadata?: Record<string, any>
) {
  const level = status === 'error' ? 'error' : 'info';

  logger[level]({
    action,
    entityId,
    status,
    ...metadata,
  });
}

// Export default
export default logger;

