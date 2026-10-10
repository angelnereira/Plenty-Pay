"use server";

/**
 * Server Actions: Lealtad y Créditos del Motor (v1: manual).
 *
 * Operan sobre el mismo ledger usando movimientos LOYALTY_GRANT / LOYALTY_REDEEM.
 * El balance de puntos se mantiene denormalizado en MotorEntity.loyaltyPointsCents.
 *
 * v1 NO incluye reglas auto-otorgadas, caducidad ni tiers.
 */

import { safeAction } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { prismaServer } from "@core/database/prisma-server";
import { getMotorPanelContext } from "@/lib/motor/context";
import { assertMotorPermission } from "@/lib/motor/permissions";
import { centsFromString } from "@/lib/motor/money";
import { serializeMotorEntry, type SerializedLedgerEntry } from "@/lib/motor/serialize";
import { recordEntry } from "@core/motor/ledger-engine";

interface LoyaltyInput {
    entityId: string;
    amountCents: string;
    description?: string;
    reference?: string;
}

export const grantLoyalty = safeAction<LoyaltyInput, SerializedLedgerEntry>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.loyalty.manage");

        const amount = centsFromString(input.amountCents);
        if (!amount || amount <= 0n) throw new Error("amountCents debe ser positivo");

        const entity = await prismaServer.motorEntity.findFirst({
            where: { id: input.entityId, clientId, deletedAt: null },
            select: { id: true },
        });
        if (!entity) throw new Error("Entidad no encontrada");

        const entry = await recordEntry({
            clientId,
            entityId: input.entityId,
            movementType: "LOYALTY_GRANT",
            amountCents: amount,
            createdById: userId,
            description: input.description,
            reference: input.reference,
        });
        revalidatePath(`/dashboard/creditos/entities/${input.entityId}`);
        revalidatePath(`/dashboard/creditos/loyalty/${input.entityId}`);
        return serializeMotorEntry(entry);
    },
    { context: "MotorGrantLoyalty" }
);

export const redeemLoyalty = safeAction<LoyaltyInput, SerializedLedgerEntry>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.loyalty.manage");

        const amount = centsFromString(input.amountCents);
        if (!amount || amount <= 0n) throw new Error("amountCents debe ser positivo");

        const entity = await prismaServer.motorEntity.findFirst({
            where: { id: input.entityId, clientId, deletedAt: null },
            select: { id: true, loyaltyPointsCents: true },
        });
        if (!entity) throw new Error("Entidad no encontrada");
        if (entity.loyaltyPointsCents < amount) {
            throw new Error(
                `Puntos insuficientes (disponibles: ${entity.loyaltyPointsCents.toString()}, solicitados: ${amount.toString()})`
            );
        }

        const entry = await recordEntry({
            clientId,
            entityId: input.entityId,
            movementType: "LOYALTY_REDEEM",
            amountCents: amount,
            createdById: userId,
            description: input.description,
            reference: input.reference,
        });
        revalidatePath(`/dashboard/creditos/entities/${input.entityId}`);
        revalidatePath(`/dashboard/creditos/loyalty/${input.entityId}`);
        return serializeMotorEntry(entry);
    },
    { context: "MotorRedeemLoyalty" }
);
