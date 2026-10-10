"use server";

/**
 * Server Actions: registrar movimientos en el ledger del Motor.
 *
 * Todos los movimientos pasan por recordEntry() que:
 *   - Lockea la entidad (FOR UPDATE) para serializar concurrencia
 *   - Valida límite de crédito en CHARGE
 *   - Calcula running balance denormalizado
 *
 * El ledger es append-only — no hay updateEntry / deleteEntry. Para corregir,
 * usar recordCompensatingEntryAction.
 */

import { safeAction } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { prismaServer } from "@core/database/prisma-server";
import { getMotorPanelContext } from "@/lib/motor/context";
import { assertMotorPermission } from "@/lib/motor/permissions";
import { centsFromString } from "@/lib/motor/money";
import { serializeMotorEntry, type SerializedLedgerEntry } from "@/lib/motor/serialize";
import {
    recordEntry,
    recordCompensatingEntry,
    getEntityBalance,
} from "@core/motor/ledger-engine";

interface ChargeInput {
    entityId: string;
    amountCents: string; // BigInt-as-string
    reference?: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

export const registerCharge = safeAction<ChargeInput, SerializedLedgerEntry>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.ledger.write");

        const amount = centsFromString(input.amountCents);
        if (!amount || amount <= 0n) throw new Error("amountCents debe ser positivo");

        // Verificar que la entidad pertenece al tenant
        const entity = await prismaServer.motorEntity.findFirst({
            where: { id: input.entityId, clientId, deletedAt: null },
            select: { id: true },
        });
        if (!entity) throw new Error("Entidad no encontrada");

        const entry = await recordEntry({
            clientId,
            entityId: input.entityId,
            movementType: "CHARGE",
            amountCents: amount,
            createdById: userId,
            reference: input.reference,
            description: input.description,
            metadata: input.metadata as never,
        });
        revalidatePath(`/dashboard/creditos/entities/${input.entityId}`);
        return serializeMotorEntry(entry);
    },
    { context: "MotorRegisterCharge" }
);

export const registerPayment = safeAction<ChargeInput, SerializedLedgerEntry>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.ledger.write");

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
            movementType: "PAYMENT",
            amountCents: amount,
            createdById: userId,
            reference: input.reference,
            description: input.description,
            metadata: input.metadata as never,
        });
        revalidatePath(`/dashboard/creditos/entities/${input.entityId}`);
        return serializeMotorEntry(entry);
    },
    { context: "MotorRegisterPayment" }
);

interface AdjustmentInput {
    entityId: string;
    sign: "CREDIT" | "DEBIT";
    amountCents: string;
    description: string;
    reference?: string;
    metadata?: Record<string, unknown>;
}

export const registerAdjustment = safeAction<AdjustmentInput, SerializedLedgerEntry>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.ledger.write");

        const amount = centsFromString(input.amountCents);
        if (!amount || amount <= 0n) throw new Error("amountCents debe ser positivo");
        if (!input.description || input.description.trim().length < 3) {
            throw new Error("description requerida (mín 3 chars) para auditar el ajuste");
        }

        const entity = await prismaServer.motorEntity.findFirst({
            where: { id: input.entityId, clientId, deletedAt: null },
            select: { id: true },
        });
        if (!entity) throw new Error("Entidad no encontrada");

        const entry = await recordEntry({
            clientId,
            entityId: input.entityId,
            movementType: input.sign === "CREDIT" ? "ADJUSTMENT_CREDIT" : "ADJUSTMENT_DEBIT",
            amountCents: amount,
            createdById: userId,
            reference: input.reference,
            description: input.description.trim(),
            metadata: input.metadata as never,
        });
        revalidatePath(`/dashboard/creditos/entities/${input.entityId}`);
        return serializeMotorEntry(entry);
    },
    { context: "MotorRegisterAdjustment" }
);

interface CompensatingInput {
    originalEntryId: string;
    reason: string;
}

export const recordCompensatingEntryAction = safeAction<
    CompensatingInput,
    SerializedLedgerEntry
>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.ledger.write");
        if (!input.reason || input.reason.trim().length < 3) {
            throw new Error("reason requerida (mín 3 chars)");
        }
        const entry = await recordCompensatingEntry(
            clientId,
            input.originalEntryId,
            input.reason.trim(),
            userId
        );
        revalidatePath(`/dashboard/creditos/entities/${entry.entityId}`);
        return serializeMotorEntry(entry);
    },
    { context: "MotorCompensatingEntry" }
);

/**
 * Saldo actual de una entidad. Útil para refresco en UI.
 */
export const getEntityBalanceAction = safeAction<{ entityId: string }, { balanceCents: string }>(
    async ({ entityId }) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.ledger.read");
        const balance = await getEntityBalance(clientId, entityId);
        return { balanceCents: balance.toString() };
    },
    { context: "MotorGetEntityBalance" }
);
