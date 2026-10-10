/**
 * core/dataport/access.ts
 *
 * Resolución de tenant y autorización para DataPort. Centraliza:
 *  - resolución de `clientId` desde la sesión (scoping forzado),
 *  - carga de flags de módulos del `Client`,
 *  - RBAC con el permiso transversal `data` (read=export, create=import,
 *    approve=datos sensibles),
 *  - gate de módulo habilitado.
 */

import { auth } from '@core/auth';
import { prismaServer as prisma } from '@core/database';
import {
    computeEffectivePermissions,
    hasPermission,
    type ModulePermission,
    type PermissionOverrides,
} from '@/lib/constants/permissions';
import type { TenantCtx, DataModule, DatasetDescriptor } from './contract';
import { isModuleEnabled } from './module-map';

export interface ResolvedAccess {
    ctx: TenantCtx;
    clientFlags: Record<string, unknown>;
    canExport: boolean;
    canImport: boolean;
}

export type AccessError = { error: string; status: number };

function isAccessError(x: ResolvedAccess | AccessError): x is AccessError {
    return (x as AccessError).error !== undefined;
}

export { isAccessError };

/** Carga la sesión, flags del tenant y permisos efectivos del actor. */
export async function resolveAccess(): Promise<ResolvedAccess | AccessError> {
    const session = await auth();
    if (!session?.user?.id || !session.user.clientId) {
        return { error: 'No autorizado', status: 401 };
    }
    // El staff interno no exporta datos de tenants por esta vía.
    if (session.user.role === 'SUPER_ADMIN') {
        return { error: 'Esta operación no está disponible para SUPER_ADMIN', status: 403 };
    }

    const clientId = session.user.clientId;

    const [client, teamMember] = await Promise.all([
        prisma.client.findUnique({ where: { id: clientId } }),
        prisma.teamMember.findUnique({
            where: { clientId_userId: { clientId, userId: session.user.id } },
            include: { teamRole: true },
        }),
    ]);

    if (!client) return { error: 'Tenant no encontrado', status: 404 };

    // Sin TeamMember se asume propietario/admin (acceso completo). Con él, se
    // computan permisos efectivos del rol + overrides.
    let perms: ModulePermission[] | null = null;
    if (teamMember?.teamRole) {
        perms = computeEffectivePermissions(
            (teamMember.teamRole.permissions as unknown as ModulePermission[]) ?? [],
            (teamMember.permissionOverrides as unknown as PermissionOverrides | null) ?? null,
        );
    }

    const isOwner = perms === null;
    const canExport = isOwner || hasPermission(perms!, 'data', 'read');
    const canImport = isOwner || hasPermission(perms!, 'data', 'create');
    const elevated = isOwner || hasPermission(perms!, 'data', 'approve');

    const ctx: TenantCtx = {
        clientId,
        actorUserId: session.user.id,
        actorEmail: session.user.email ?? 'desconocido',
        elevated,
    };

    return { ctx, clientFlags: client as unknown as Record<string, unknown>, canExport, canImport };
}

/** Valida que un dataset se pueda exportar para este tenant/actor. Lanza Error con mensaje claro. */
export function assertDatasetExportable(
    d: DatasetDescriptor,
    access: ResolvedAccess,
): void {
    if (!isModuleEnabled(d.module, access.clientFlags)) {
        throw new Error(`El módulo '${d.module}' no está habilitado para tu organización`);
    }
    if ((d.sensitivity === 'pii' || d.sensitivity === 'fiscal') && !access.ctx.elevated) {
        throw new Error(`El dataset '${d.key}' contiene datos sensibles y requiere permiso elevado`);
    }
}

/** Valida que un dataset se pueda importar. */
export function assertDatasetImportable(
    d: DatasetDescriptor,
    access: ResolvedAccess,
): void {
    if (!isModuleEnabled(d.module, access.clientFlags)) {
        throw new Error(`El módulo '${d.module}' no está habilitado para tu organización`);
    }
    if (!d.importSpec) {
        throw new Error(`El dataset '${d.key}' es de solo exportación (no admite importación)`);
    }
}

export type { DataModule };
