/**
 * Permisos del Motor sobre TeamRole.permissions (JSON existente).
 *
 * Formato del campo TeamRole.permissions (ya en uso en el repo):
 *   [{ module: "motor", actions: ["entities.read", "ledger.write", ...] }]
 *
 * Política transitoria (deny-by-default):
 *   - Usuario sin TeamMember activo en el tenant => sin permisos del Motor.
 *   - Usuario con TeamMember pero sin entry "module: motor" => sin permisos.
 *   - "*" en actions concede todas las acciones del módulo.
 *   - SUPER_ADMIN NO opera el Motor desde su rol — gestiona asignaciones.
 *     La verificación SUPER_ADMIN debe hacerse explícitamente en actions
 *     que lo requieran (ver assignments.ts).
 */

import { prismaServer } from "@core/database/prisma-server";

export const MOTOR_PERMISSION_KEYS = [
    "motor.entities.read",
    "motor.entities.write",
    "motor.schema.manage",
    "motor.ledger.read",
    "motor.ledger.write",
    "motor.loyalty.manage",
] as const;

export type MotorPermissionKey = (typeof MOTOR_PERMISSION_KEYS)[number];

interface PermissionEntry {
    module: string;
    actions: string[];
}

function isPermissionEntry(value: unknown): value is PermissionEntry {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return typeof v.module === "string" && Array.isArray(v.actions);
}

export async function hasMotorPermission(
    userId: string,
    clientId: string,
    key: MotorPermissionKey
): Promise<boolean> {
    // Users with active MotorUserAccess have full Motor panel permissions.
    // This is the primary authorization gate; TeamRole motor permissions
    // provide optional granular overrides when explicitly configured.
    const motorAccess = await prismaServer.motorUserAccess.findUnique({
        where: { userId },
        select: { status: true, clientId: true },
    });
    if (motorAccess?.status === "ACTIVE" && motorAccess.clientId === clientId) {
        return true;
    }

    // Fallback: check TeamRole motor permissions (granular control)
    const membership = await prismaServer.teamMember.findFirst({
        where: { userId, clientId, isActive: true },
        include: { teamRole: true },
    });
    if (!membership) return false;

    const raw = membership.teamRole.permissions;
    const perms: PermissionEntry[] = Array.isArray(raw)
        ? (raw.filter(isPermissionEntry) as unknown as PermissionEntry[])
        : [];
    const motorPerms = perms.find((p) => p.module === "motor");
    if (!motorPerms) return false;

    const action = key.replace(/^motor\./, "");
    return motorPerms.actions.includes(action) || motorPerms.actions.includes("*");
}

export async function assertMotorPermission(
    userId: string,
    clientId: string,
    key: MotorPermissionKey
): Promise<void> {
    const ok = await hasMotorPermission(userId, clientId, key);
    if (!ok) {
        throw new Error(`Permiso requerido: ${key}`);
    }
}
