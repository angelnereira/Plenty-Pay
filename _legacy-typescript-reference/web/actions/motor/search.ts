"use server";

/**
 * Server Actions universales del Motor (sin gate de panel).
 *
 * Disponibles para CUALQUIER usuario con sesión válida en un tenant.
 * Pensados para alimentar:
 *   - Autocompletado de receptor en facturación
 *   - "Clientes recientes" en POS
 *   - Pre-fill de datos al crear facturas / órdenes
 *
 * NO exponen el ledger, balances ni campos custom — solo identidad
 * básica. Si se necesita data financiera, el usuario debe tener
 * MotorUserAccess y entrar al panel.
 */

import { safeAction } from "@/lib/safe-action";
import { prismaServer } from "@core/database/prisma-server";
import { getMotorTenantContext } from "@/lib/motor/context";
import type { MotorEntityKind } from "@prisma/client";

export interface MotorEntitySummary {
    id: string;
    kind: MotorEntityKind;
    displayName: string;
    documentType: string | null;
    documentNumber: string | null;
    primaryEmail: string | null;
    primaryPhone: string | null;
    customFields?: Record<string, any> | null;
}

interface SearchInput {
    q?: string; // texto libre
    kind?: MotorEntityKind;
    limit?: number;
}

/**
 * Busca entidades del tenant por nombre, documento o email.
 * Devuelve solo identidad básica — sin campos financieros.
 */
export const searchEntities = safeAction<SearchInput, MotorEntitySummary[]>(
    async (input) => {
        const { clientId } = await getMotorTenantContext();
        const limit = Math.min(input.limit ?? 10, 50);
        const q = input.q?.trim();

        const entities = await (prismaServer as any).motorEntity.findMany({
            where: {
                clientId,
                deletedAt: null,
                isActive: true,
                ...(input.kind ? { kind: input.kind } : {}),
                ...(q
                    ? {
                          OR: [
                              { displayName: { contains: q, mode: "insensitive" } },
                              { documentNumber: { contains: q } },
                              { primaryEmail: { contains: q, mode: "insensitive" } },
                          ],
                      }
                    : {}),
            },
            select: {
                id: true,
                kind: true,
                displayName: true,
                documentType: true,
                documentNumber: true,
                primaryEmail: true,
                primaryPhone: true,
                customFields: true,
            },
            orderBy: q ? { displayName: "asc" } : { updatedAt: "desc" },
            take: limit,
        });
        return entities;
    },
    { context: "MotorSearchEntities", logInput: false, logOutput: false }
);

/**
 * Lista las N entidades más recientes del tenant.
 * Sin filtro: útil para "clientes recientes" en POS sin que el cajero
 * tenga que escribir nada.
 */
export const getRecentEntities = safeAction<{ limit?: number; kind?: MotorEntityKind }, MotorEntitySummary[]>(
    async (input) => {
        const { clientId } = await getMotorTenantContext();
        const limit = Math.min(input.limit ?? 8, 30);
        const entities = await (prismaServer as any).motorEntity.findMany({
            where: {
                clientId,
                deletedAt: null,
                isActive: true,
                ...(input.kind ? { kind: input.kind } : {}),
            },
            select: {
                id: true,
                kind: true,
                displayName: true,
                documentType: true,
                documentNumber: true,
                primaryEmail: true,
                primaryPhone: true,
                customFields: true,
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
        });
        return entities;
    },
    { context: "MotorRecentEntities", logInput: false, logOutput: false }
);

/**
 * Busca una entidad exacta por documento. Útil para auto-pre-fill
 * cuando el cajero/usuario teclea el RUC en facturación.
 */
export const findEntityByDocument = safeAction<
    { documentNumber: string },
    MotorEntitySummary | null
>(
    async ({ documentNumber }) => {
        const { clientId } = await getMotorTenantContext();
        const trimmed = documentNumber.trim();
        if (!trimmed) return null;
        const entity = await (prismaServer as any).motorEntity.findFirst({
            where: {
                clientId,
                documentNumber: trimmed,
                deletedAt: null,
                isActive: true,
            },
            select: {
                id: true,
                kind: true,
                displayName: true,
                documentType: true,
                documentNumber: true,
                primaryEmail: true,
                primaryPhone: true,
                customFields: true,
            },
        });
        return entity;
    },
    { context: "MotorFindByDocument", logInput: false, logOutput: false }
);
