"use server";

/**
 * Server Actions: gestión del acceso al panel del Motor.
 * Solo SUPER_ADMIN.
 *
 * v1.1: el Motor es infraestructura universal. Lo que el Super Admin
 * controla aquí es qué USUARIOS específicos pueden ver y operar la UI
 * de configuración avanzada (Schema Builder, ajustes manuales del
 * ledger, créditos, lealtad, comprobantes, etc.).
 *
 * Los usuarios sin acceso al panel siguen viendo el flujo implícito
 * (autocompletado, clientes recientes) en facturación y POS.
 */

import { safeAction } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { prismaServer } from "@core/database/prisma-server";
import { auth } from "@core/auth";

async function requireSuperAdmin(): Promise<{ userId: string }> {
    const session = await auth();
    if (!session?.user?.id) throw new Error("No autorizado");
    if (session.user.role !== "SUPER_ADMIN") {
        throw new Error("Requiere rol SUPER_ADMIN");
    }
    return { userId: session.user.id };
}

interface GrantInput {
    targetUserId: string;
    notes?: string;
}

export const grantMotorPanelAccess = safeAction<
    GrantInput,
    { id: string; status: string }
>(
    async (input) => {
        const { userId: superAdminId } = await requireSuperAdmin();

        const user = await prismaServer.user.findUnique({
            where: { id: input.targetUserId },
            select: { id: true, clientId: true, isActive: true },
        });
        if (!user) throw new Error("Usuario no encontrado");
        if (!user.isActive) throw new Error("Usuario inactivo");
        if (!user.clientId) throw new Error("Usuario sin tenant");

        const access = await prismaServer.motorUserAccess.upsert({
            where: { userId: input.targetUserId },
            create: {
                userId: input.targetUserId,
                clientId: user.clientId,
                status: "ACTIVE",
                grantedBy: superAdminId,
                notes: input.notes,
            },
            update: {
                status: "ACTIVE",
                clientId: user.clientId,
                revokedAt: null,
                grantedAt: new Date(),
                grantedBy: superAdminId,
                notes: input.notes,
            },
        });
        revalidatePath("/dashboard/admin/motor-access");
        return { id: access.id, status: access.status };
    },
    { context: "MotorGrantPanelAccess" }
);

interface RevokeInput {
    targetUserId: string;
    reason?: string;
}

export const revokeMotorPanelAccess = safeAction<
    RevokeInput,
    { id: string; status: string }
>(
    async (input) => {
        await requireSuperAdmin();

        const existing = await prismaServer.motorUserAccess.findUnique({
            where: { userId: input.targetUserId },
        });
        if (!existing) throw new Error("Acceso no encontrado");
        if (existing.status === "REVOKED") {
            return { id: existing.id, status: existing.status };
        }

        const updated = await prismaServer.motorUserAccess.update({
            where: { userId: input.targetUserId },
            data: {
                status: "REVOKED",
                revokedAt: new Date(),
                notes: input.reason
                    ? `${existing.notes ?? ""}\nRevocado: ${input.reason}`
                    : existing.notes,
            },
        });
        revalidatePath("/dashboard/admin/motor-access");
        return { id: updated.id, status: updated.status };
    },
    { context: "MotorRevokePanelAccess" }
);

