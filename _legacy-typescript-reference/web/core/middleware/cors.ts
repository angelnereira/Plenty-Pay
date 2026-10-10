/**
 * CORS Middleware para Next.js API Routes
 *
 * Proporciona configuración CORS segura para las API routes.
 *
 * USO:
 *   import { withCors, corsHeaders } from '@core/middleware/cors';
 *
 *   // Opción 1: Aplicar CORS headers manualmente
 *   export async function GET(request: Request) {
 *     const response = NextResponse.json({ data: '...' });
 *     return corsHeaders(response, request);
 *   }
 *
 *   // Opción 2: Wrapper function
 *   export const GET = withCors(async (request: Request) => {
 *     return NextResponse.json({ data: '...' });
 *   });
 *
 * CONFIGURACIÓN:
 *   - Orígenes permitidos: ALLOWED_ORIGINS (env) o NEXTAUTH_URL
 *   - Métodos: GET, POST, PUT, DELETE, PATCH, OPTIONS
 *   - Headers: Content-Type, Authorization
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Obtiene lista de orígenes permitidos desde variables de entorno
 */
function getAllowedOrigins(): string[] {
  const allowed = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  const authUrl = process.env.NEXTAUTH_URL;

  // Incluir NEXTAUTH_URL como origen permitido por defecto
  if (authUrl && !allowed.includes(authUrl)) {
    allowed.push(authUrl);
  }

  // En desarrollo, permitir localhost en varios puertos
  if (process.env.NODE_ENV === 'development') {
    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];

    devOrigins.forEach(origin => {
      if (!allowed.includes(origin)) {
        allowed.push(origin);
      }
    });
  }

  return allowed;
}

/**
 * Verifica si un origen está permitido
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins();

  // En desarrollo, permitir todos los localhost
  if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

/**
 * Configuración CORS por defecto
 */
export const CORS_CONFIG = {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  headers: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-CSRF-Token',
  ],
  maxAge: 86400, // 24 horas
  credentials: true,
};

/**
 * Aplica headers CORS a una respuesta
 *
 * @param response - La respuesta de Next.js
 * @param request - La request original (para obtener el origin)
 * @returns Respuesta con headers CORS
 */
export function corsHeaders(
  response: NextResponse,
  request: Request | NextRequest
): NextResponse {
  const origin = request.headers.get('origin');

  // Determinar origen permitido
  let allowedOrigin: string;

  if (isOriginAllowed(origin)) {
    allowedOrigin = origin!;
  } else {
    // Fallback al primer origen permitido o al NEXTAUTH_URL
    const allowed = getAllowedOrigins();
    allowedOrigin = allowed[0] || process.env.NEXTAUTH_URL || '';
  }

  // Aplicar headers CORS
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', CORS_CONFIG.methods.join(', '));
  response.headers.set('Access-Control-Allow-Headers', CORS_CONFIG.headers.join(', '));
  response.headers.set('Access-Control-Max-Age', String(CORS_CONFIG.maxAge));

  if (CORS_CONFIG.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

/**
 * Maneja preflight requests (OPTIONS)
 *
 * @param request - La request OPTIONS
 * @returns Respuesta 204 con headers CORS
 */
export function handlePreflight(request: Request | NextRequest): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return corsHeaders(response, request);
}

/**
 * Higher-order function que envuelve un handler con soporte CORS
 *
 * @param handler - El handler de la ruta API
 * @returns Handler envuelto con CORS
 *
 * @example
 * export const GET = withCors(async (request: Request) => {
 *   return NextResponse.json({ data: 'hello' });
 * });
 */
export function withCors<T extends Request | NextRequest>(
  handler: (request: T) => Promise<NextResponse> | NextResponse
) {
  return async (request: T): Promise<NextResponse> => {
    // Manejar preflight
    if (request.method === 'OPTIONS') {
      return handlePreflight(request);
    }

    // Ejecutar handler
    try {
      const response = await handler(request);
      return corsHeaders(response, request);
    } catch (error) {
      // En caso de error, también aplicar CORS headers
      const errorResponse = NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal Server Error' },
        { status: 500 }
      );
      return corsHeaders(errorResponse, request);
    }
  };
}

/**
 * Configuración CORS personalizada para rutas específicas
 *
 * @example
 * export const GET = withCorsConfig({
 *   methods: ['GET'],
 *   headers: ['Content-Type'],
 *   credentials: false,
 * }, async (request: Request) => {
 *   return NextResponse.json({ data: 'hello' });
 * });
 */
export function withCorsConfig<T extends Request | NextRequest>(
  config: Partial<typeof CORS_CONFIG>,
  handler: (request: T) => Promise<NextResponse> | NextResponse
) {
  const mergedConfig = { ...CORS_CONFIG, ...config };

  return async (request: T): Promise<NextResponse> => {
    // Manejar preflight
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      const origin = request.headers.get('origin');

      if (isOriginAllowed(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin!);
      }

      response.headers.set('Access-Control-Allow-Methods', mergedConfig.methods.join(', '));
      response.headers.set('Access-Control-Allow-Headers', mergedConfig.headers.join(', '));
      response.headers.set('Access-Control-Max-Age', String(mergedConfig.maxAge));

      if (mergedConfig.credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }

      return response;
    }

    // Ejecutar handler
    try {
      const response = await handler(request);
      const origin = request.headers.get('origin');

      if (isOriginAllowed(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin!);
      }

      response.headers.set('Access-Control-Allow-Methods', mergedConfig.methods.join(', '));
      response.headers.set('Access-Control-Allow-Headers', mergedConfig.headers.join(', '));

      if (mergedConfig.credentials) {
        response.headers.set('Access-Control-Allow-Credentials', 'true');
      }

      return response;
    } catch (error) {
      const errorResponse = NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal Server Error' },
        { status: 500 }
      );

      const origin = request.headers.get('origin');
      if (isOriginAllowed(origin)) {
        errorResponse.headers.set('Access-Control-Allow-Origin', origin!);
      }

      return errorResponse;
    }
  };
}

/**
 * Crea una respuesta JSON con CORS headers aplicados
 */
export function corsJson(
  data: any,
  request: Request | NextRequest,
  options?: ResponseInit
): NextResponse {
  const response = NextResponse.json(data, options);
  return corsHeaders(response, request);
}

export default withCors;
