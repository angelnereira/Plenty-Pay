/**
 * Formateador de respuestas de error para API
 * Diferencia entre SUPER_ADMIN y usuarios normales
 */

import { NextResponse } from 'next/server';
import { handleApiError, sanitizeError } from './error-handler';

export function createErrorResponse(
  error: unknown,
  statusCode: number = 500,
  userRole?: string,
  userId?: string
) {
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const result = handleApiError(error, userRole, userId);
  
  // Para Super Admin o en desarrollo, incluir detalles
  if (isSuperAdmin || isDevelopment) {
    return NextResponse.json(
      {
        success: false,
        error: result.message,
        details: result.details,
        ...(isSuperAdmin && { _debug: 'Super Admin Mode - Detalles completos' }),
      },
      { status: statusCode }
    );
  }
  
  // Para usuarios normales, solo mensaje
  return NextResponse.json(
    {
      success: false,
      error: result.message,
    },
    { status: statusCode }
  );
}

/**
 * Helper para errores 404
 */
export function notFoundResponse(userRole?: string) {
  const message = userRole === 'SUPER_ADMIN' 
    ? 'Recurso no encontrado. Verifica el ID proporcionado.' 
    : 'Recurso no encontrado';
  
  return NextResponse.json(
    { success: false, error: message },
    { status: 404 }
  );
}

/**
 * Helper para errores de autorización
 */
export function unauthorizedResponse(userRole?: string) {
  const message = userRole === 'SUPER_ADMIN'
    ? 'No autorizado. Verifica tus permisos de acceso.'
    : 'No autorizado';
  
  return NextResponse.json(
    { success: false, error: message },
    { status: 401 }
  );
}

/**
 * Helper para errores de validación
 */
export function validationErrorResponse(
  errors: string[],
  userRole?: string
) {
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  
  return NextResponse.json(
    {
      success: false,
      error: 'Error de validación',
      ...(isSuperAdmin && { 
        validationErrors: errors,
        _debug: 'Super Admin Mode - Errores de validación detallados'
      }),
      ...(!isSuperAdmin && {
        message: 'Por favor, verifica los datos ingresados'
      }),
    },
    { status: 400 }
  );
}

