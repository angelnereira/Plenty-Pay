/**
 * Middleware para registrar llamadas a APIs
 * Guarda todos los detalles de requests y responses en la BD
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@core/database';
import { auth } from '@core/auth';

interface ApiLogData {
  method: string;
  path: string;
  endpoint: string;
  userId?: string;
  clientId?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  requestQuery?: Record<string, string>;
  statusCode: number;
  responseBody?: string;
  success: boolean;
  errorMessage?: string;
  ip?: string;
  userAgent?: string;
  duration?: number;
  apiName?: string;
  apiMethod?: string;
}

/**
 * Registra una llamada a API en la base de datos
 */
export async function logApiCall(data: ApiLogData): Promise<void> {
  try {
    // Limitar el tamaño de los bodies para no sobrecargar la BD
    const maxBodySize = 5000; // 5KB max
    
    await prisma.apiLog.create({
      data: {
        method: data.method,
        path: data.path,
        endpoint: data.endpoint,
        userId: data.userId,
        clientId: data.clientId,
        requestHeaders: data.requestHeaders || {},
        requestBody: data.requestBody ? data.requestBody.substring(0, maxBodySize) : undefined,
        requestQuery: data.requestQuery || {},
        statusCode: data.statusCode,
        responseBody: data.responseBody ? data.responseBody.substring(0, maxBodySize) : undefined,
        responseHeaders: {},
        success: data.success,
        errorMessage: data.errorMessage ? data.errorMessage.substring(0, 500) : undefined,
        ip: data.ip,
        userAgent: data.userAgent,
        duration: data.duration,
        apiName: data.apiName,
        apiMethod: data.apiMethod,
      },
    });
  } catch (error) {
    // No lanzar error si falla el logging para no romper la API
    console.error('[ApiLogger] Error al registrar llamada:', error);
  }
}

/**
 * Middleware wrapper para APIs que registra automáticamente
 */
export function withApiLogger<T>(
  handler: (req: NextRequest) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;
    
    // Extraer user de la sesión
    let userId: string | undefined;
    let clientId: string | undefined;
    try {
      const session = await auth();
      if (session?.user) {
        userId = session.user.id;
        clientId = session.user.clientId;
      }
    } catch (error) {
      // Session puede fallar en algunas rutas, continuar sin user
    }

    // Leer el body del request (para logging)
    let requestBody: string | undefined;
    try {
      const clone = req.clone();
      const reader = clone.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        if (value) {
          requestBody = new TextDecoder().decode(value);
        }
      }
    } catch (error) {
      // No crítico si no se puede leer el body
    }

    let statusCode = 500;
    let responseBody: string | undefined;
    let success = false;
    let errorMessage: string | undefined;

    try {
      // Ejecutar el handler
      const response = await handler(req);
      statusCode = response.status;
      
      // Leer la respuesta (limitado)
      const responseClone = response.clone();
      try {
        const data = await responseClone.text();
        responseBody = data;
        success = statusCode >= 200 && statusCode < 400;
      } catch (error) {
        success = statusCode >= 200 && statusCode < 400;
      }

      // Registrar después de la respuesta exitosa
      const duration = Date.now() - startTime;
      
      await logApiCall({
        method,
        path,
        endpoint: `${method} ${path}`,
        userId,
        clientId,
        requestHeaders: Object.fromEntries(req.headers.entries()),
        requestBody,
        requestQuery: Object.fromEntries(url.searchParams.entries()),
        statusCode,
        responseBody,
        success,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        duration,
      });

      return response;
    } catch (error) {
      statusCode = 500;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      success = false;

      const duration = Date.now() - startTime;
      
      await logApiCall({
        method,
        path,
        endpoint: `${method} ${path}`,
        userId,
        clientId,
        requestHeaders: Object.fromEntries(req.headers.entries()),
        requestBody,
        requestQuery: Object.fromEntries(url.searchParams.entries()),
        statusCode,
        responseBody: errorMessage,
        success,
        errorMessage,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
        userAgent: req.headers.get('user-agent') || undefined,
        duration,
      });

      throw error;
    }
  };
}

