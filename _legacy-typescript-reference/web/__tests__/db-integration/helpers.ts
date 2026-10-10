/**
 * Helpers compartidos para tests de integración con base de datos real.
 *
 * Cada suite crea sus fixtures con un sufijo único por corrida y los
 * elimina al final, así la base de pruebas puede reutilizarse entre corridas.
 */

import { prisma } from '@/lib/db';

export { prisma };

/** Sufijo único por corrida para evitar colisiones entre tests/corridas. */
export const RUN_ID = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Guard-rail: jamás correr tests de integración contra producción. */
export function assertSafeDatabase(): void {
  const url = process.env.DATABASE_URL || '';
  // El host del pooler de producción identificado en scripts/verify-env.js
  if (url.includes('ep-purple-bread')) {
    throw new Error(
      'PELIGRO: DATABASE_URL apunta a la base de datos de PRODUCCIÓN. ' +
      'Los tests de integración solo deben correr contra bases de prueba.'
    );
  }
}

/** Crea una organización (modelo Client) de prueba. */
export async function createTestOrg(label: string) {
  return prisma.client.create({
    data: {
      name: `Org Test ${label} ${RUN_ID}`,
      slug: `org-${label}-${RUN_ID}`,
    },
  });
}

/** Borra una organización y todo lo que cuelga de ella (cascade). */
export async function deleteTestOrg(orgId: string) {
  await prisma.client.delete({ where: { id: orgId } }).catch(() => {
    // Si ya fue borrada por el propio test, no es un error
  });
}
