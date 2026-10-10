/**
 * Prisma Client para Server Actions y Server Components
 * 
 * Este cliente usa el singleton base SIN extensiones para evitar
 * problemas de serialización en Server Actions de Next.js 15.
 * 
 * Usar este cliente en:
 * - Server Actions (formularios, mutaciones)
 * - API Routes que modifican datos
 * - NextAuth authorize callback
 * 
 * Para queries de lectura optimizadas con extensiones, usar lib/prisma.ts
 * 
 * @see https://www.prisma.io/docs/orm/more/help-and-troubleshooting/help-articles/nextjs-prisma-client-dev-practices
 */

import prismaBase from './prisma-singleton'

// Exportar el cliente base directamente (sin extensiones)
export const prismaServer = prismaBase

// Export default para imports más simples
export default prismaServer

