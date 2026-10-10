import { PrismaClient } from '@prisma/client';
import { neon } from '@neondatabase/serverless';

// ============================================
// PRISMA CLIENT (Para operaciones complejas)
// ============================================
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// ============================================
// NEON DATA API (Para consultas rápidas y Edge)
// ============================================
export const sql = neon(process.env.DATABASE_URL!);

// Logging de seguridad al iniciar (solo en servidor)
if (process.env.NODE_ENV !== 'test') {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    try {
      // Extraer host para loguear sin revelar credenciales
      const url = new URL(dbUrl);
      console.log(`[DB] 🔌 Conectado a: ${url.hostname} (${process.env.NODE_ENV})`);
    } catch (e) {
      console.error('[DB] ❌ Error parseando DATABASE_URL');
    }
  }
}

// ============================================
// TIPO HELPER PARA NEON QUERIES
// ============================================
export type NeonQueryResult<T = any> = T[];

// ============================================
// FUNCIONES HELPER
// ============================================

/**
 * Ejecuta una consulta Prisma con manejo de errores
 * Ideal para operaciones CRUD complejas
 */
export async function executePrismaQuery<T = any>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('Error en Prisma Query:', error);
    throw error;
  }
}

/**
 * Nota sobre Neon Data API:
 * 
 * El objeto `sql` exportado se usa con tagged templates:
 * 
 * Ejemplo:
 *   const users = await sql`SELECT * FROM users WHERE id = ${userId}`;
 * 
 * NO usar como función con strings:
 *   const users = await sql("SELECT * FROM users WHERE id = ?", [userId]); // ❌ Incorrecto
 */

