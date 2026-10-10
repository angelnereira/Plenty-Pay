/**
 * HKA Logger System
 * Sistema de logging estructurado para integración HKA
 *
 * Características:
 * - Persiste en DB (ApiLog, InvoiceLog)
 * - Niveles de log (DEBUG, INFO, WARN, ERROR, CRITICAL)
 * - Metadata estructurada
 * - Truncado automático de XML largos
 * - Correlación entre capas
 */

import { prisma } from '@core/database';
import type { HKAError } from './errors';

/**
 * Niveles de logging
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/**
 * Entrada de log estructurada
 */
export interface HKALogEntry {
  /** Nivel de severidad */
  level: LogLevel;

  /** Método HKA ejecutado */
  method: string;

  /** ID de la factura (opcional) */
  invoiceId?: string;

  /** ID del cliente/tenant (opcional) */
  clientId?: string;

  /** Timestamp del evento */
  timestamp: Date;

  /** Duración de la operación en ms (opcional) */
  duration?: number;

  /** Información del request */
  request?: {
    /** URL del endpoint */
    endpoint: string;
    /** Body del request (XML truncado) */
    body?: string;
    /** Headers relevantes */
    headers?: Record<string, string>;
  };

  /** Información de la respuesta */
  response?: {
    /** Status code HTTP */
    statusCode?: number;
    /** Body de la respuesta (XML truncado) */
    body?: string;
    /** Código de respuesta HKA */
    hkaCode?: string;
  };

  /** Información del error (si aplica) */
  error?: {
    /** Tipo de error */
    type: string;
    /** Mensaje de error */
    message: string;
    /** Stack trace (opcional) */
    stack?: string;
    /** Recoverable flag */
    recoverable?: boolean;
  };

  /** Fase del workflow (0-8 para orchestrator) */
  phase?: number;

  /** Metadata adicional */
  metadata?: Record<string, unknown>;

  /** ID de usuario que ejecutó la acción (opcional) */
  userId?: string;

  /** Email de usuario (opcional) */
  userEmail?: string;
}

/**
 * Configuración del logger
 */
interface LoggerConfig {
  /** Habilitar logs en consola (dev) */
  enableConsole: boolean;
  /** Habilitar persistencia en DB */
  enableDatabase: boolean;
  /** Máximo de caracteres para XML (truncar) */
  maxXmlLength: number;
  /** Nivel mínimo para loggear */
  minLevel: LogLevel;
}

const DEFAULT_CONFIG: LoggerConfig = {
  enableConsole: process.env.NODE_ENV === 'development',
  enableDatabase: true,
  maxXmlLength: 2000,
  minLevel: 'INFO',
};

/**
 * Logger principal para HKA
 */
export class HKALogger {
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Loggea una entrada
   */
  async log(entry: HKALogEntry): Promise<void> {
    // Filtrar por nivel
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // Truncar XML si es necesario
    const processedEntry = this.processEntry(entry);

    // Log en consola (dev)
    if (this.config.enableConsole) {
      this.logToConsole(processedEntry);
    }

    // Persistir en DB
    if (this.config.enableDatabase) {
      await this.logToDatabase(processedEntry);
    }
  }

  /**
   * Conveniencia: Log nivel DEBUG
   */
  async debug(method: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log({
      level: 'DEBUG',
      method,
      timestamp: new Date(),
      metadata: { message, ...metadata },
    });
  }

  /**
   * Conveniencia: Log nivel INFO
   */
  async info(method: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log({
      level: 'INFO',
      method,
      timestamp: new Date(),
      metadata: { message, ...metadata },
    });
  }

  /**
   * Conveniencia: Log nivel WARN
   */
  async warn(method: string, message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log({
      level: 'WARN',
      method,
      timestamp: new Date(),
      metadata: { message, ...metadata },
    });
  }

  /**
   * Conveniencia: Log nivel ERROR
   */
  async error(
    method: string,
    error: Error | HKAError,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      level: 'ERROR',
      method,
      timestamp: new Date(),
      error: {
        type: error.name,
        message: error.message,
        stack: error.stack,
        recoverable: 'recoverable' in error ? error.recoverable : false,
      },
      metadata,
    });
  }

  /**
   * Conveniencia: Log nivel CRITICAL
   */
  async critical(
    method: string,
    error: Error | HKAError,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      level: 'CRITICAL',
      method,
      timestamp: new Date(),
      error: {
        type: error.name,
        message: error.message,
        stack: error.stack,
        recoverable: 'recoverable' in error ? error.recoverable : false,
      },
      metadata,
    });
  }

  /**
   * Determina si debe loggear según el nivel
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    const minIndex = levels.indexOf(this.config.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  /**
   * Procesa la entrada (trunca XML, etc.)
   */
  private processEntry(entry: HKALogEntry): HKALogEntry {
    const processed = { ...entry };

    // Truncar XML en request
    if (processed.request?.body) {
      processed.request.body = this.truncateXML(processed.request.body);
    }

    // Truncar XML en response
    if (processed.response?.body) {
      processed.response.body = this.truncateXML(processed.response.body);
    }

    return processed;
  }

  /**
   * Trunca XML a longitud máxima
   */
  private truncateXML(xml: string): string {
    if (xml.length <= this.config.maxXmlLength) {
      return xml;
    }

    return xml.substring(0, this.config.maxXmlLength) + '... [truncated]';
  }

  /**
   * Log a consola (desarrollo)
   */
  private logToConsole(entry: HKALogEntry): void {
    const emoji = {
      DEBUG: '🔍',
      INFO: 'ℹ️',
      WARN: '⚠️',
      ERROR: '❌',
      CRITICAL: '🔥',
    };

    const color = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      CRITICAL: '\x1b[35m', // Magenta
    };

    const reset = '\x1b[0m';

    /*
    console.log(
      `${emoji[entry.level]} ${color[entry.level]}[${entry.level}]${reset} ` +
      `${entry.method} ` +
      `${entry.duration ? `(${entry.duration}ms)` : ''}`
    );

    if (entry.error) {
      console.error(`  Error: ${entry.error.message}`);
    }

    if (entry.metadata) {
      console.log('  Metadata:', JSON.stringify(entry.metadata, null, 2));
    }
    */
  }

  /**
   * Persiste en base de datos
   */
  private async logToDatabase(entry: HKALogEntry): Promise<void> {
    try {
      // 1. Guardar en ApiLog (todas las llamadas HKA)
      await this.saveToApiLog(entry);

      // 2. Si hay invoiceId, también guardar en InvoiceLog
      if (entry.invoiceId) {
        await this.saveToInvoiceLog(entry);
      }
    } catch (error) {
      // No fallar si el logging falla - solo log a consola
      console.error('Failed to persist log to database:', error);
    }
  }

  /**
   * Guarda en ApiLog
   */
  private async saveToApiLog(entry: HKALogEntry): Promise<void> {
    const success = entry.level !== 'ERROR' && entry.level !== 'CRITICAL';

    await prisma.apiLog.create({
      data: {
        method: 'POST',
        path: `/hka/${entry.method}`,
        endpoint: entry.request?.endpoint || `/hka/${entry.method}`,
        apiName: 'HKA',
        apiMethod: entry.method,
        requestBody: entry.request?.body,
        responseBody: entry.response?.body,
        statusCode: entry.response?.statusCode || (success ? 200 : 500),
        success,
        errorMessage: entry.error?.message,
        duration: entry.duration,
        clientId: entry.clientId,
        // Note: ApiLog no tiene campo metadata, usar requestBody/responseBody en su lugar
        createdAt: entry.timestamp,
      },
    });
  }

  /**
   * Guarda en InvoiceLog
   */
  private async saveToInvoiceLog(entry: HKALogEntry): Promise<void> {
    if (!entry.invoiceId) return;

    const action = this.mapLevelToAction(entry.level);

    // Construir mensaje
    let message = '';
    if (entry.error) {
      message = `Error en ${entry.method}: ${entry.error.message}`;
    } else if (entry.metadata?.message) {
      message = String(entry.metadata.message);
    } else {
      message = `HKA ${entry.method} - ${entry.level}`;
    }

    await prisma.invoiceLog.create({
      data: {
        invoiceId: entry.invoiceId,
        action: action as any,
        message,
        metadata: {
          level: entry.level,
          method: entry.method,
          hkaCode: entry.response?.hkaCode,
          duration: entry.duration,
          phase: entry.phase,
          errorType: entry.error?.type,
          recoverable: entry.error?.recoverable,
          ...entry.metadata,
        } as any,
        userId: entry.userId,
        userEmail: entry.userEmail,
      },
    });
  }

  /**
   * Mapea nivel de log a acción de InvoiceLog
   */
  private mapLevelToAction(level: LogLevel): string {
    switch (level) {
      case 'DEBUG':
      case 'INFO':
        return 'PROCESSING';
      case 'WARN':
        return 'WARNING';
      case 'ERROR':
      case 'CRITICAL':
        return 'ERROR';
      default:
        return 'PROCESSING';
    }
  }
}

/**
 * Instancia global del logger
 */
export const hkaLogger = new HKALogger();

/**
 * Helper: Crea contexto de logging para una operación
 */
export function createLogContext(options: {
  method: string;
  invoiceId?: string;
  clientId?: string;
  userId?: string;
  userEmail?: string;
}): Partial<HKALogEntry> {
  return {
    method: options.method,
    invoiceId: options.invoiceId,
    clientId: options.clientId,
    userId: options.userId,
    userEmail: options.userEmail,
    timestamp: new Date(),
  };
}

/**
 * Helper: Mide duración de una operación
 */
export async function withDurationTracking<T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await operation();
  const duration = Date.now() - start;
  return { result, duration };
}
