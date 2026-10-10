/**
 * Error Handler Middleware
 *
 * Middleware para API routes que captura y maneja errores automáticamente:
 * - Logging unificado (Pino + DB)
 * - Request ID tracking
 * - Respuestas HTTP estructuradas
 * - Context enrichment
 *
 * @example
 * ```ts
 * import { withErrorHandler } from '@core/middleware/error-handler';
 *
 * async function handler(request: NextRequest) {
 *   const data = await processData();
 *   return Response.json({ data });
 * }
 *
 * export const POST = withErrorHandler(handler);
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/services/logger.service';
import { auth } from '@core/auth';
import { Prisma } from '@prisma/client';

// ============================================
// CUSTOM ERRORS
// ============================================

/**
 * Error base para errores de aplicación
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Error de validación (400)
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Error de autenticación (401)
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'No autorizado') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Error de autorización (403)
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'No tienes permisos para esta acción') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * Error de recurso no encontrado (404)
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso no encontrado') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Error de conflicto (409)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT_ERROR', details);
    this.name = 'ConflictError';
  }
}

/**
 * Error de rate limit (429)
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Demasiadas solicitudes, intenta más tarde') {
    super(message, 429, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

// ============================================
// ERROR HANDLER
// ============================================

/**
 * Determina status code desde el error
 */
function getStatusCode(error: any): number {
  // Errores de aplicación
  if (error instanceof AppError) {
    return error.statusCode;
  }

  // Errores de Prisma
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': return 409; // Unique constraint violation
      case 'P2025': return 404; // Record not found
      case 'P2003': return 400; // Foreign key constraint
      default: return 500;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return 400;
  }

  // Default
  return 500;
}

/**
 * Extrae código de error
 */
function getErrorCode(error: any): string {
  if (error instanceof AppError && error.code) {
    return error.code;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }

  return 'INTERNAL_ERROR';
}

/**
 * Obtiene mensaje de error user-friendly
 */
function getUserMessage(error: any, statusCode: number): string {
  // Mensajes predefinidos para codes de Prisma
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return 'Ya existe un registro con estos datos';
      case 'P2025':
        return 'Registro no encontrado';
      case 'P2003':
        return 'Operación inválida: referencia a dato inexistente';
      default:
        return 'Error de base de datos';
    }
  }

  // Mensajes de errores de aplicación
  if (error instanceof AppError) {
    return error.message;
  }

  // Mensajes genéricos por status code
  switch (statusCode) {
    case 400:
      return 'Solicitud inválida';
    case 401:
      return 'No autorizado';
    case 403:
      return 'No tienes permisos para esta acción';
    case 404:
      return 'Recurso no encontrado';
    case 409:
      return 'Conflicto con datos existentes';
    case 429:
      return 'Demasiadas solicitudes';
    default:
      return 'Error interno del servidor';
  }
}

/**
 * Determina si el error debe ser loggeado
 */
function shouldLogError(statusCode: number): boolean {
  // No loggear errores de cliente (4xx) excepto 401 y 403
  return statusCode >= 500 || statusCode === 401 || statusCode === 403;
}

// ============================================
// MIDDLEWARE
// ============================================

type ApiHandler = (request: NextRequest, context?: any) => Promise<Response>;

/**
 * Wrapper para API route handlers que captura y maneja errores
 */
export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (request: NextRequest, context?: any): Promise<Response> => {
    const startTime = Date.now();

    // Generar Request ID
    const requestId =
      request.headers.get('x-request-id') ||
      `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      // Obtener sesión para contexto
      const session = await auth();

      // Crear logger con contexto
      const contextLogger = logger.withContext({
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        clientId: session?.user?.clientId,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      // Log request
      contextLogger.info('API Request received');

      // Ejecutar handler
      const response = await handler(request, context);

      // Log success
      const duration = Date.now() - startTime;
      contextLogger.info('API Request completed', {
        statusCode: response.status,
        duration,
      });

      // Añadir Request ID al response header
      response.headers.set('X-Request-ID', requestId);

      return response;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const statusCode = getStatusCode(error);
      const errorCode = getErrorCode(error);
      const userMessage = getUserMessage(error, statusCode);

      // Obtener sesión para contexto (si aún no se tiene)
      const session = await auth().catch(() => null);

      // Crear logger con contexto completo
      const contextLogger = logger.withContext({
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        clientId: session?.user?.clientId,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        duration,
      });

      // Log error (solo si es relevante)
      if (shouldLogError(statusCode)) {
        await contextLogger.error(
          `API Request failed: ${userMessage}`,
          error,
          {
            persist: true,
            context: {
              errorCode,
              statusCode,
            },
          }
        );
      } else {
        // Errores de cliente solo en Pino (no DB)
        contextLogger.warn(`API Request failed: ${userMessage}`, {
          errorCode,
          statusCode,
          error: error.message,
        });
      }

      // Construir respuesta de error
      const errorResponse = {
        error: userMessage,
        code: errorCode,
        requestId,
        ...(error instanceof AppError && error.details && { details: error.details }),
        // En desarrollo, incluir stack trace
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack,
          raw: error.message,
        }),
      };

      return NextResponse.json(errorResponse, {
        status: statusCode,
        headers: {
          'X-Request-ID': requestId,
        },
      });
    }
  };
}

/**
 * Helper: Verifica autenticación y lanza error si no hay sesión
 */
export async function requireAuth() {
  const session = await auth();
  if (!session) {
    throw new AuthenticationError();
  }
  return session;
}

/**
 * Helper: Verifica que el usuario tenga un clientId
 */
export async function requireClient() {
  const session = await requireAuth();
  if (!session.user.clientId) {
    throw new AuthorizationError('Usuario sin organización asignada');
  }
  return { session, clientId: session.user.clientId };
}

/**
 * Helper: Verifica rol de usuario
 */
export async function requireRole(role: 'SUPER_ADMIN' | 'CLIENT') {
  const session = await requireAuth();
  if (session.user.role !== role) {
    throw new AuthorizationError(`Esta acción requiere rol: ${role}`);
  }
  return session;
}
