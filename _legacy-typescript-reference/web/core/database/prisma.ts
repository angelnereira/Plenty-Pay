/**
 * Prisma Client Optimizado con Extensiones
 * 
 * Este cliente usa el singleton base + extensiones para queries optimizadas.
 * 
 * ⚠️ IMPORTANTE: NO usar en Server Actions debido a problemas de serialización.
 * Las extensiones devuelven objetos Proxy que no son serializables.
 * 
 * Usar este cliente en:
 * - Server Components (solo lectura)
 * - API Routes GET (solo lectura)
 * - Dashboards y listados
 * 
 * Para Server Actions y mutaciones, usar lib/prisma-server.ts
 * 
 * @see https://www.prisma.io/docs/orm/prisma-client/client-extensions
 */

import prismaBase from './prisma-singleton'
import { withAccelerate } from '@prisma/extension-accelerate'
import { pagination } from 'prisma-extension-pagination'

// Global para almacenar el cliente con extensiones
const globalForPrisma = globalThis as unknown as {
  prismaExtended: ReturnType<typeof createPrismaClient> | undefined
}

// Función para crear el cliente con todas las extensiones
function createPrismaClient() {
  // Aplicar extensiones en cadena al cliente base singleton
  const client = prismaBase
    // 1. Accelerate: Caching y connection pooling
    .$extends(withAccelerate())

    // 2. Paginación: Facilita queries paginadas
    .$extends(
      pagination({
        pages: {
          limit: 20, // Límite por defecto
          includePageCount: true, // Incluir total de páginas
        },
      })
    )

  return client
}

// Crear o reutilizar el cliente con extensiones
export const prisma = globalForPrisma.prismaExtended ?? createPrismaClient()

// En desarrollo, guardar en global para hot-reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaExtended = prisma
}

// Tipo exportado para usar en toda la app
export type PrismaClientExtended = typeof prisma

/**
 * Helper para obtener datos serializables desde queries con extensiones
 * 
 * Uso en Server Actions (si realmente necesitas usar este cliente):
 * ```typescript
 * const user = await getPrismaData(() => prisma.user.findUnique({ where: { id } }))
 * ```
 */
export const getPrismaData = async <T extends (...args: any[]) => any>(
  queryFn: T
): Promise<Awaited<ReturnType<T>>> => {
  const result = await queryFn()
  // Convertir a JSON y parsear para eliminar Proxies
  return JSON.parse(JSON.stringify(result))
}
