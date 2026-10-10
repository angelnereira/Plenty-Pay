/**
 * Helpers para caché de Prisma Accelerate
 * Implementa estrategias de caché diferenciadas por tipo de dato
 * 
 * @see https://www.prisma.io/docs/accelerate/caching
 */

// TTL por tipo de dato (en segundos)
export const CACHE_TTL = {
    /** Datos estáticos: catálogos, configuraciones globales */
    STATIC: 3600,      // 1 hora

    /** Datos semi-estáticos: clientes, usuarios, configuraciones */
    SEMI_STATIC: 300,  // 5 minutos

    /** Datos dinámicos: facturas recientes, listados */
    DYNAMIC: 60,       // 1 minuto

    /** Sin caché: estadísticas en tiempo real, contadores */
    REALTIME: 0,
} as const

export type CacheTTL = typeof CACHE_TTL[keyof typeof CACHE_TTL]

/**
 * Helper para construir opciones de caché para Prisma Accelerate
 * 
 * @example
 * const invoices = await prisma.invoice.findMany({
 *   where: { clientId },
 *   ...withCache(CACHE_TTL.DYNAMIC)
 * })
 */
export function withCache(ttl: number = CACHE_TTL.DYNAMIC) {
    if (ttl === 0) return {}

    return {
        cacheStrategy: {
            ttl,
            swr: Math.floor(ttl / 2), // Stale-while-revalidate
        },
    }
}

/**
 * Helper para queries frecuentes con caché preconfigurado
 */
export const cacheStrategies = {
    /** Para listados de facturas */
    invoices: withCache(CACHE_TTL.DYNAMIC),

    /** Para listado de clientes */
    customers: withCache(CACHE_TTL.SEMI_STATIC),

    /** Para catálogos (CPBS, tipos, etc.) */
    catalogs: withCache(CACHE_TTL.STATIC),

    /** Para estadísticas del dashboard */
    dashboardStats: withCache(30), // 30 segundos

    /** Sin caché para datos críticos */
    realtime: withCache(CACHE_TTL.REALTIME),
} as const
