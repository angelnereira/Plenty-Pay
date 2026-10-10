/**
 * Enforcement central de límites del plan.
 *
 * Centraliza las dos validaciones que están repetidas (o ausentes) por la
 * app: cantidad de usuarios y cajas POS concurrentes. Llama desde Server
 * Actions y endpoints API antes de mutaciones que crearían un usuario o
 * abrirían una sesión POS. Lanza Error con mensaje en español listo para
 * mostrar al cliente.
 *
 * Política:
 *   - assertWithinUserLimit cuenta usuarios CLIENT activos del tenant.
 *     Excluye SUPER_ADMIN (que pueden estar adscritos a un client por
 *     impersonation pero no consumen licencia).
 *   - assertWithinPosLimit cuenta sesiones POS con actividad en los
 *     últimos 5 minutos y status ACTIVE — coincide con la lógica que ya
 *     usa /dashboard/configuracion/suscripcion para contar "activas".
 *
 * El límite efectivo es Client.maxUsers / Client.maxPosStations, que ya
 * incluye el plan + extras pagados (lo aplica /api/admin/approve-upgrade
 * al aprobar capacidad adicional).
 */

import { prismaServer } from "@core/database/prisma-server";

export class LimitExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LimitExceededError";
    }
}

const POS_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;

export async function assertWithinUserLimit(clientId: string): Promise<void> {
    const client = await prismaServer.client.findUnique({
        where: { id: clientId },
        select: { maxUsers: true },
    });
    if (!client) throw new LimitExceededError("Tenant no encontrado");

    const currentCount = await prismaServer.user.count({
        where: {
            clientId,
            isActive: true,
            role: { not: "SUPER_ADMIN" },
        },
    });

    if (currentCount >= client.maxUsers) {
        throw new LimitExceededError(
            `Límite de usuarios alcanzado (${currentCount}/${client.maxUsers}). ` +
                `Actualiza tu plan o contrata usuarios extra para agregar más.`
        );
    }
}

export async function assertWithinPosLimit(clientId: string): Promise<void> {
    const client = await prismaServer.client.findUnique({
        where: { id: clientId },
        select: { maxPosStations: true },
    });
    if (!client) throw new LimitExceededError("Tenant no encontrado");

    const cutoff = new Date(Date.now() - POS_ACTIVITY_WINDOW_MS);
    const activeCount = await prismaServer.posSession.count({
        where: {
            clientId,
            status: "ACTIVE",
            lastActivity: { gte: cutoff },
        },
    });

    if (activeCount >= client.maxPosStations) {
        throw new LimitExceededError(
            `Límite de cajas POS concurrentes alcanzado (${activeCount}/${client.maxPosStations}). ` +
                `Cierra una caja activa o contrata cajas extra para abrir otra.`
        );
    }
}
