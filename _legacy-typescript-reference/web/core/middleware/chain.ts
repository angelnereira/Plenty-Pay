/**
 * Middleware Chain Pattern
 * 
 * Composable middleware for Next.js API routes.
 * Allows chaining auth, rate limiting, logging, and validation.
 * 
 * @module lib/middleware/chain
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { Session } from 'next-auth';

// ============================================
// TYPES
// ============================================

/**
 * Extended request context with middleware data
 */
export interface MiddlewareContext {
    /** Authenticated session (if auth middleware used) */
    session?: Session | null;
    /** Current user from session */
    user?: Session['user'];
    /** Client ID from user */
    clientId?: string;
    /** Request start time for logging */
    startTime: number;
    /** Correlation ID for tracing */
    correlationId: string;
    /** Custom data added by middleware */
    data: Record<string, unknown>;
}

/**
 * Handler function with context
 */
export type RouteHandler = (
    request: NextRequest,
    context: MiddlewareContext
) => Promise<NextResponse> | NextResponse;

/**
 * Middleware function
 */
export type Middleware = (
    request: NextRequest,
    context: MiddlewareContext,
    next: () => Promise<NextResponse>
) => Promise<NextResponse>;

/**
 * Middleware chain builder
 */
export interface MiddlewareChain {
    use: (middleware: Middleware) => MiddlewareChain;
    handler: (handler: RouteHandler) => (request: NextRequest) => Promise<NextResponse>;
}

// ============================================
// CHAIN BUILDER
// ============================================

/**
 * Create a middleware chain
 * 
 * @example
 * ```typescript
 * const apiChain = createChain()
 *   .use(loggingMiddleware)
 *   .use(authMiddleware)
 *   .use(rateLimitMiddleware('api'));
 * 
 * export const POST = apiChain.handler(async (req, ctx) => {
 *   // Handler logic with ctx.user, ctx.clientId, etc.
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function createChain(): MiddlewareChain {
    const middlewares: Middleware[] = [];

    const chain: MiddlewareChain = {
        use(middleware: Middleware) {
            middlewares.push(middleware);
            return chain;
        },

        handler(routeHandler: RouteHandler) {
            return async (request: NextRequest): Promise<NextResponse> => {
                // Initial context
                const context: MiddlewareContext = {
                    startTime: Date.now(),
                    correlationId: request.headers.get('x-correlation-id') || crypto.randomUUID(),
                    data: {},
                };

                // Build middleware chain
                let index = 0;

                const next = async (): Promise<NextResponse> => {
                    if (index < middlewares.length) {
                        const middleware = middlewares[index++];
                        return middleware(request, context, next);
                    }
                    // All middleware passed, execute handler
                    return routeHandler(request, context);
                };

                try {
                    return await next();
                } catch (error) {
                    console.error('[MiddlewareChain] Unhandled error:', error);
                    return NextResponse.json(
                        { error: 'Internal server error' },
                        { status: 500 }
                    );
                }
            };
        },
    };

    return chain;
}

// ============================================
// BUILT-IN MIDDLEWARE
// ============================================

/**
 * Authentication middleware - requires authenticated session
 */
export const authMiddleware: Middleware = async (request, context, next) => {
    const session = await auth();

    if (!session?.user) {
        return NextResponse.json(
            { error: 'No autorizado' },
            { status: 401 }
        );
    }

    context.session = session;
    context.user = session.user;
    context.clientId = session.user.clientId;

    return next();
};

/**
 * Optional auth middleware - adds session if available but doesn't require it
 */
export const optionalAuthMiddleware: Middleware = async (request, context, next) => {
    const session = await auth();

    if (session?.user) {
        context.session = session;
        context.user = session.user;
        context.clientId = session.user.clientId;
    }

    return next();
};

/**
 * Role-based access control middleware
 */
export function requireRole(...roles: string[]): Middleware {
    return async (request, context, next) => {
        if (!context.user) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        if (!roles.includes(context.user.role || '')) {
            return NextResponse.json(
                { error: 'No tienes permisos para realizar esta acción' },
                { status: 403 }
            );
        }

        return next();
    };
}

/**
 * Super admin only middleware
 */
export const superAdminOnly: Middleware = requireRole('SUPER_ADMIN');

/**
 * Logging middleware
 */
export const loggingMiddleware: Middleware = async (request, context, next) => {
    const method = request.method;
    const url = request.nextUrl.pathname;

    console.log(`[${context.correlationId}] --> ${method} ${url}`);

    const response = await next();

    const duration = Date.now() - context.startTime;
    console.log(`[${context.correlationId}] <-- ${method} ${url} ${response.status} (${duration}ms)`);

    return response;
};

/**
 * CORS middleware
 */
export function corsMiddleware(options?: {
    origins?: string[];
    methods?: string[];
    headers?: string[];
}): Middleware {
    const allowedOrigins = options?.origins || ['*'];
    const allowedMethods = options?.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
    const allowedHeaders = options?.headers || ['Content-Type', 'Authorization'];

    return async (request, context, next) => {
        const origin = request.headers.get('origin') || '';

        // Handle preflight
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': allowedOrigins.includes('*') ? '*' : origin,
                    'Access-Control-Allow-Methods': allowedMethods.join(', '),
                    'Access-Control-Allow-Headers': allowedHeaders.join(', '),
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        const response = await next();

        // Add CORS headers to response
        response.headers.set(
            'Access-Control-Allow-Origin',
            allowedOrigins.includes('*') ? '*' : origin
        );

        return response;
    };
}

/**
 * Rate limiter middleware factory
 */
export function rateLimitMiddleware(
    limiterName: 'api' | 'invoiceCreate' | 'hkaSend' | 'auth'
): Middleware {
    return async (request, context, next) => {
        // Dynamic import to avoid issues if Redis not configured
        try {
            const { rateLimiters, checkRateLimit } = await import('@core/middleware/rate-limit');
            const limiter = rateLimiters[limiterName];

            if (limiter) {
                const identifier = context.user?.id ||
                    request.headers.get('x-forwarded-for') ||
                    'anonymous';

                await checkRateLimit(limiter, identifier);
            }
        } catch (error) {
            // If rate limit exceeded, return 429
            if (error instanceof Error && error.name === 'RateLimitError') {
                return NextResponse.json(
                    { error: 'Demasiadas solicitudes. Intenta más tarde.' },
                    { status: 429 }
                );
            }
            // For other errors (Redis not configured), continue without rate limiting
            console.warn('[RateLimit] Rate limiting unavailable:', error);
        }

        return next();
    };
}

/**
 * JSON body parser middleware
 */
export function jsonBodyMiddleware<T>(): Middleware {
    return async (request, context, next) => {
        try {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                const body = await request.json();
                context.data.body = body as T;
            }
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid JSON body' },
                { status: 400 }
            );
        }

        return next();
    };
}

/**
 * Validation middleware using Zod schema
 */
export function validateBody<T>(schema: {
    parse: (data: unknown) => T;
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { issues: unknown[] } };
}): Middleware {
    return async (request, context, next) => {
        try {
            const body = context.data.body || await request.json();
            const result = schema.safeParse(body);

            if (!result.success) {
                return NextResponse.json(
                    { error: 'Datos inválidos', details: result.error?.issues },
                    { status: 400 }
                );
            }

            context.data.validatedBody = result.data;
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        return next();
    };
}

// ============================================
// PRE-BUILT CHAINS
// ============================================

/**
 * Standard API chain with auth and logging
 */
export const apiChain = createChain()
    .use(loggingMiddleware)
    .use(authMiddleware);

/**
 * Public API chain (no auth required)
 */
export const publicChain = createChain()
    .use(loggingMiddleware)
    .use(optionalAuthMiddleware);

/**
 * Admin API chain (SUPER_ADMIN only)
 */
export const adminChain = createChain()
    .use(loggingMiddleware)
    .use(authMiddleware)
    .use(superAdminOnly);

/**
 * HKA API chain with rate limiting
 */
export const hkaChain = createChain()
    .use(loggingMiddleware)
    .use(authMiddleware)
    .use(rateLimitMiddleware('hkaSend'));
