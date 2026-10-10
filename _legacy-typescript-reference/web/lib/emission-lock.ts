/**
 * lib/emission-lock.ts
 * 
 * Utilidad de bloqueo distribuido para la emisión de facturas.
 * Garantiza la integridad secuencial al evitar que múltiples usuarios
 * de una misma organización intenten usar el "próximo número" simultáneamente.
 */

import { redis } from './redis';

const LOCK_PREFIX = 'lock:emission:client:';
const DEFAULT_TTL = 60; // 60 segundos por defecto (tiempo suficiente para el SOAP de HKA)

/**
 * Intenta adquirir un bloqueo de emisión para un cliente.
 * 
 * @param clientId - ID del cliente (empresa)
 * @param ttlSeconds - Tiempo de vida del bloqueo
 * @returns true si se adquirió el bloqueo, false si ya estaba bloqueado
 */
export async function acquireEmissionLock(clientId: string, ttlSeconds = DEFAULT_TTL): Promise<boolean> {
  const key = `${LOCK_PREFIX}${clientId}`;
  
  // SET NX: Solo establece la clave si NO existe
  const success = await redis.set(key, 'LOCKED', {
    nx: true,
    ex: ttlSeconds
  });

  return success === 'OK';
}

/**
 * Libera el bloqueo de emisión para un cliente.
 */
export async function releaseEmissionLock(clientId: string): Promise<void> {
  const key = `${LOCK_PREFIX}${clientId}`;
  await redis.del(key);
}

/**
 * Verifica si el canal de emisión está bloqueado actualmente.
 */
export async function isEmissionLocked(clientId: string): Promise<boolean> {
  const key = `${LOCK_PREFIX}${clientId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}
