/**
 * Gate de acceso al Módulo de Créditos para layouts y Server Components.
 *
 * v2.1 (tiered pricing): el módulo es producto de pago en 3 escalas
 * (TIER_1 / TIER_2 / TIER_3). El acceso requiere DOS condiciones:
 *
 *   - Client.creditosEnabled = true (gate visible/oculto)
 *   - Client.motorCreditTier IS NOT NULL (tier asignado por SUPER_ADMIN)
 *
 * El "Motor de Clientes" (entidades, deduplicación, ledger) sigue
 * corriendo por debajo para todos los tenants. Solo se gatea la UI del
 * Módulo de Créditos.
 *
 * Llama notFound() si:
 *   - No hay sesión
 *   - El usuario no pertenece a un tenant
 *   - El usuario es SUPER_ADMIN (no opera el módulo desde su rol)
 *   - El tenant tiene creditosEnabled = false
 *   - El tenant tiene motorCreditTier = null (sin tier asignado)
 */

import type { Session } from "next-auth";
import { auth } from "@core/auth";
import { prismaServer } from "@core/database/prisma-server";
import { notFound } from "next/navigation";

export interface CreditAccess {
    session: Session;
    clientId: string;
    userId: string;
}

export async function requireCreditAccess(): Promise<CreditAccess> {
    const session = (await auth()) as Session | null;
    if (!session?.user?.id || !session.user.clientId) {
        notFound();
    }
    if (session.user.role === "SUPER_ADMIN") {
        notFound();
    }
    const client = await prismaServer.client.findUnique({
        where: { id: session.user.clientId },
        select: { creditosEnabled: true, motorCreditTier: true },
    });
    if (!client || !client.creditosEnabled || !client.motorCreditTier) {
        notFound();
    }
    return {
        session,
        clientId: session.user.clientId,
        userId: session.user.id,
    };
}

// Alias retro-compat: los archivos que aún importan requireMotorAccess
// siguen funcionando; la semántica es la misma (ahora gateada por flag).
export const requireMotorAccess = requireCreditAccess;
export type MotorAccess = CreditAccess;

/**
 * Verifica si un usuario tiene acceso al panel avanzado del Motor
 * (Schema Builder, intereses por ciclo, ajustes manuales). Esto NO
 * gatea el Módulo de Créditos visible — solo decora la UI con
 * funcionalidad extra para usuarios concretos seleccionados por el
 * SUPER_ADMIN en /dashboard/admin/motor-access.
 */
export async function userHasMotorPanelAccess(userId: string): Promise<boolean> {
    const access = await prismaServer.motorUserAccess.findUnique({
        where: { userId },
        select: { status: true },
    });
    return access?.status === "ACTIVE";
}
