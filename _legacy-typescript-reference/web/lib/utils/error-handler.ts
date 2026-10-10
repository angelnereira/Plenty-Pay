/**
 * Sistema de manejo de errores mejorado para SUPER_ADMIN
 * Proporciona mensajes detallados en ambiente de desarrollo/pruebas
 */

import { loggers, logError } from './logger';

export interface ErrorDetails {
  message: string;
  stack?: string;
  code?: string;
  context?: Record<string, any>;
  cause?: Error;
  timestamp: string;
  userId?: string;
  userRole?: string;
}

export class DetailedError extends Error {
  public code: string;
  public context: Record<string, any>;
  public cause?: Error;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(message);
    this.name = 'DetailedError';
    this.code = code;
    this.context = context;
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Captura errores y proporciona detalles según el rol del usuario
 */
export function handleApiError(
  error: unknown,
  userRole?: string,
  userId?: string,
  additionalContext?: Record<string, any>
): { message: string; details?: ErrorDetails } {
  
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  
  // Log completo del error
  logError(error, {
    context: 'API_ERROR_HANDLER',
    userId,
    userRole,
    ...additionalContext,
  });

  // Si es Super Admin, proporcionar detalles completos
  if (isSuperAdmin) {
    return {
      message: 'Error procesando solicitud',
      details: extractErrorDetails(error, userId, userRole, additionalContext),
    };
  }

  // Para usuarios normales, mensaje genérico
  return {
    message: 'Error al procesar la solicitud. Por favor, intente nuevamente.',
  };
}

/**
 * Extrae detalles completos del error
 */
function extractErrorDetails(
  error: unknown,
  userId?: string,
  userRole?: string,
  context?: Record<string, any>
): ErrorDetails {
  const details: ErrorDetails = {
    message: 'Error desconocido',
    timestamp: new Date().toISOString(),
    userId,
    userRole,
    context,
  };

  if (error instanceof DetailedError) {
    details.message = error.message;
    details.code = error.code;
    details.context = { ...details.context, ...error.context };
    details.cause = error.cause;
  } else if (error instanceof Error) {
    details.message = error.message;
    details.stack = error.stack;
    
    // Extraer código de error si es un error conocido
    if ((error as any).code) {
      details.code = (error as any).code;
    }
  } else if (typeof error === 'string') {
    details.message = error;
  }

  return details;
}

/**
 * Crea un error detallado con contexto
 */
export function createDetailedError(
  message: string,
  code: string,
  context: Record<string, any> = {}
): DetailedError {
  return new DetailedError(message, code, context);
}

/**
 * Helper para validación con errores detallados
 */
export function validateWithError<T>(
  condition: boolean,
  errorMessage: string,
  errorCode: string = 'VALIDATION_ERROR',
  context?: Record<string, any>
): asserts condition {
  if (!condition) {
    throw new DetailedError(errorMessage, errorCode, context);
  }
}

/**
 * Middleware para capturar errores no manejados en API routes
 */
export function withErrorHandling(
  handler: (req: Request, userId?: string, userRole?: string) => Promise<Response>
) {
  return async (req: Request, userId?: string, userRole?: string) => {
    try {
      return await handler(req, userId, userRole);
    } catch (error) {
      const result = handleApiError(error, userRole, userId);
      
      return new Response(
        JSON.stringify(result),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

/**
 * Sanitizar errores antes de enviar al cliente
 * Elimina información sensible en producción
 */
export function sanitizeError(error: ErrorDetails, isDevelopment: boolean = false): any {
  if (isDevelopment) {
    return error; // En desarrollo, mostrar todo
  }

  // En producción, ocultar stack trace y contexto sensible
  return {
    message: error.message,
    code: error.code,
    timestamp: error.timestamp,
  };
}

