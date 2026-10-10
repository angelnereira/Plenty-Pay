/**
 * Database Client Re-export
 * 
 * Este archivo existe para compatibilidad con imports legacy que usan '@core/database'.
 * Re-exporta el cliente Prisma desde la ubicación correcta.
 * 
 * Para nuevos archivos, prefiere importar directamente desde:
 * - '@core/database' para queries generales
 * - '@core/database' para Server Actions (sin Proxy)
 */

// Re-export prisma client for legacy imports
export { prisma } from './prisma';
export { prismaServer } from './prisma-server';

// Cache helpers for Prisma Accelerate
export { CACHE_TTL, withCache, cacheStrategies } from './prisma-cache';

// Also export default for those who use default import
export { default as prismaBase } from './prisma-singleton';

