/**
 * Middleware Optimizado para Vercel Edge (< 1MB)
 *
 * Este middleware NO usa NextAuth directamente para mantener el tamaño bajo.
 * En su lugar:
 * 1. Aplica rate limiting vía Upstash Redis (antes de cualquier otra lógica)
 * 2. Permite rutas públicas sin verificación de sesión
 * 3. Deja que Server Components y Server Actions manejen auth
 *
 * Rate Limiters:
 *   - AUTH:    5 req / 10s  por IP  (rutas /api/auth/* y /auth/*)
 *   - GENERAL: 100 req / 15s por IP (resto de la app)
 *
 * Política de fallo: fail-open (si Redis no responde, se permite la petición)
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ─── Clientes de Rate Limiting (inicializados fuera de la función para reutilizar) ─────────
let authLimiter: Ratelimit | null = null
let generalLimiter: Ratelimit | null = null

function getLimiters() {
  if (authLimiter && generalLimiter) return { authLimiter, generalLimiter }

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    // Variables no disponibles en este entorno — Rate limiting deshabilitado
    return { authLimiter: null, generalLimiter: null }
  }

  const redis = new Redis({ url, token })

  authLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    prefix: 'rl:auth',
    analytics: false,
  })

  generalLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '15 s'),
    prefix: 'rl:general',
    analytics: false,
  })

  return { authLimiter, generalLimiter }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anonymous'
  )
}

function rateLimitResponse(retryAfter: string | number): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: 'Too Many Requests', retryAfter }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    }
  )
}

// ─── Middleware principal ────────────────────────────────────────────────────
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  // ── 1. RATE LIMITING ──────────────────────────────────────────────────────
  // Solo aplicar a rutas que no son archivos estáticos (ya exclusas en matcher)
  // Exclude read-only NextAuth endpoints — called on every page load, not sensitive
  const isAuthReadOnly =
    pathname === '/api/auth/session' ||
    pathname === '/api/auth/csrf' ||
    pathname === '/api/auth/providers'

  const isAuthRoute =
    !isAuthReadOnly && (
      pathname.startsWith('/api/auth/') ||
      pathname.startsWith('/auth/signin') ||
      pathname.startsWith('/auth/signup') ||
      pathname.startsWith('/auth/forgot-password') ||
      pathname.startsWith('/auth/reset-password')
    )

  try {
    const { authLimiter: al, generalLimiter: gl } = getLimiters()

    if (isAuthRoute && al) {
      const { success, reset } = await al.limit(ip)
      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000)
        console.warn(`[RateLimit:AUTH] Blocked IP ${ip} on ${pathname}`)
        return rateLimitResponse(retryAfter)
      }
    } else if (gl) {
      // ── Optimización de Cuota (Upstash Free Tier) ──
      // Solo aplicar rate limit general a:
      // 1. Todas las rutas de API (/api/*)
      // 2. Todos los métodos de mutación (POST, PUT, DELETE, PATCH) en cualquier ruta
      // 3. Excluir navegaciones GET a páginas de la UI (para ahorrar cuota)
      const isApiRoute = pathname.startsWith('/api/');
      const isMutation = request.method !== 'GET' && request.method !== 'HEAD';

      if (isApiRoute || isMutation) {
        // Rate limit general (excluye /api/auth/ para evitar doble conteo)
        if (!pathname.startsWith('/api/auth/')) {
          const { success, reset } = await gl.limit(ip);
          if (!success) {
            const retryAfter = Math.ceil((reset - Date.now()) / 1000);
            console.warn(`[RateLimit:GENERAL] Blocked IP ${ip} on ${pathname} (${request.method})`);
            return rateLimitResponse(retryAfter);
          }
        }
      }
    }
  } catch (err) {
    // Política fail-open: si Redis falla, continuamos sin rate limiting
    console.error('[RateLimit] Redis error, allowing request:', err)
  }

  // ── 2. LÓGICA DE SESIÓN Y ROUTING (sin cambios) ───────────────────────────
  const sessionToken =
    request.cookies.get('authjs.session-token') ||
    request.cookies.get('__Secure-authjs.session-token') ||
    request.cookies.get('next-auth.session-token') ||
    request.cookies.get('__Secure-next-auth.session-token')

  // Redirigir usuarios AUTENTICADOS fuera de / y /auth/* hacia el dashboard
  const isLandingPage = pathname === '/'
  const isAuthPage = pathname.startsWith('/auth/') && pathname !== '/auth/error'

  if (sessionToken && (isLandingPage || isAuthPage)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Rutas públicas que NO requieren autenticación
  const publicRoutes = [
    '/',
    '/auth/signin',
    '/auth/signup',
    '/auth/error',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/setup-password',
    '/auth/verify-email',
    '/about',
    '/contact',
    '/terms',
    '/privacy',
  ]

  const isPublicRoute = publicRoutes.some(route => {
    if (route === '/') return pathname === '/'
    return pathname.startsWith(route)
  })

  if (isPublicRoute || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Para rutas PROTEGIDAS: si no hay session token, redirigir a login
  if (!sessionToken) {
    const loginUrl = new URL('/auth/signin', request.url)
    const fullPath = request.nextUrl.search
      ? `${pathname}${request.nextUrl.search}`
      : pathname
    loginUrl.searchParams.set('callbackUrl', fullPath)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}


export const config = {
  // Excluir archivos estáticos, PWA y API de NextAuth
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - manifest.json (web app manifest)
     * - icons/* (pwa icons)
     * - sw.js (service worker)
     * - swe-worker-*.js (service worker extensions)
     * - workbox-*.js (workbox runtime)
     * - fallback-*.js (offline fallback)
     * - *.png, *.jpg, *.svg, etc (images)
     */
    '/((?!monitoring|_next/static|_next/image|favicon.ico|manifest.json|icons/.*|sw\\.js|custom-sw\\.js|swe-worker-.*\\.js|workbox-.*\\.js|fallback-.*\\.js|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|.*\\.webp).*)',
  ],
}

