/**
 * Prisma Client Singleton Pattern
 * 
 * Implementa el patrón singleton recomendado por Prisma para Next.js
 * para evitar múltiples instancias y agotamiento de conexiones.
 * 
 * @see https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices
 */

import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

  // Nota: La zona horaria se maneja a nivel de aplicación usando las funciones
  // de lib/utils/date-timezone.ts. PostgreSQL almacena fechas en UTC, y las funciones
  // de formato convierten correctamente a zona horaria de Panamá al mostrar.

  return client
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>
} & typeof global

const prismaBase = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prismaBase
export { prismaBase as prisma }

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prismaBase
}
