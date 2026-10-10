"use server";

/**
 * Aplicación de intereses sobre saldo deudor de entidades del Motor.
 *
 * Convención del ledger:
 *   balance < 0  → el cliente adeuda al tenant
 *   balance > 0  → el cliente tiene saldo a favor
 *
 * El interés se calcula SOLO cuando balance < 0 (hay deuda).
 * interestAmount = abs(balance) × (tasa / 100)
 *
 * La tasa y el ciclo se configuran al crear/editar la entidad y se
 * almacenan en customFields._ext.creditSettings.
 */

import { safeAction } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { prismaServer } from "@core/database/prisma-server";
import { getMotorPanelContext } from "@/lib/motor/context";
import { assertMotorPermission } from "@/lib/motor/permissions";
import { serializeMotorEntry, type SerializedLedgerEntry } from "@/lib/motor/serialize";
import { recordEntry, getEntityBalance } from "@core/motor/ledger-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditSettings {
    interestRatePercent?: string;
    paymentCycleType?: "monthly" | "biweekly" | "weekly";
    paymentCycleDayOfMonth?: number;
}

export interface EntityCreditInfo {
    entityId: string;
    displayName: string;
    balanceCents: string;
    settings: CreditSettings;
    hasSettings: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCreditSettings(customFields: unknown): CreditSettings {
    if (!customFields || typeof customFields !== "object") return {};
    const cf = customFields as Record<string, unknown>;
    const ext = cf._ext;
    if (!ext || typeof ext !== "object") return {};
    const extObj = ext as Record<string, unknown>;
    const cs = extObj.creditSettings;
    if (!cs || typeof cs !== "object") return {};
    return cs as CreditSettings;
}

function calcInterestCents(balanceCents: bigint, ratePercent: string): bigint {
    // Interest only on negative balances (debt)
    if (balanceCents >= 0n) return 0n;
    const debtCents = -balanceCents;
    // rate is stored as "2.5" → multiply by 100 to work in integer arithmetic
    const rateFloat = parseFloat(ratePercent);
    if (!Number.isFinite(rateFloat) || rateFloat <= 0) return 0n;
    // interest = debt × rate / 100, rounded to nearest cent
    // Use integer math: debt × rateX1000 / 100000
    const rateX1000 = BigInt(Math.round(rateFloat * 1000));
    return (debtCents * rateX1000 + 50000n) / 100000n; // +50000n for rounding
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Obtiene la información de crédito de una entidad (balance + settings).
 * Sin side-effects, no requiere ledger.write.
 */
export const getEntityCreditInfo = safeAction<
    { entityId: string },
    EntityCreditInfo
>(
    async ({ entityId }) => {
        const { clientId } = await getMotorPanelContext();

        const entity = await prismaServer.motorEntity.findFirst({
            where: { id: entityId, clientId, deletedAt: null },
            select: { id: true, displayName: true, customFields: true },
        });
        if (!entity) throw new Error("Entidad no encontrada");

        const balance = await getEntityBalance(clientId, entityId);
        const settings = extractCreditSettings(entity.customFields);

        return {
            entityId,
            displayName: entity.displayName,
            balanceCents: balance.toString(),
            settings,
            hasSettings: !!(settings.interestRatePercent && parseFloat(settings.interestRatePercent) > 0),
        };
    },
    { context: "MotorGetEntityCreditInfo" }
);

/**
 * Aplica interés al saldo deudor de una entidad.
 * Crea un CHARGE por el monto de interés calculado.
 * Solo opera si balance < 0 y hay tasa configurada.
 */
export const applyInterest = safeAction<
    { entityId: string },
    SerializedLedgerEntry & { interestCents: string }
>(
    async ({ entityId }) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.ledger.write");

        const entity = await prismaServer.motorEntity.findFirst({
            where: { id: entityId, clientId, deletedAt: null },
            select: { id: true, displayName: true, customFields: true },
        });
        if (!entity) throw new Error("Entidad no encontrada");

        const settings = extractCreditSettings(entity.customFields);
        if (!settings.interestRatePercent || parseFloat(settings.interestRatePercent) <= 0) {
            throw new Error("Esta entidad no tiene tasa de interés configurada");
        }

        const balance = await getEntityBalance(clientId, entityId);
        if (balance >= 0n) {
            throw new Error("No hay saldo deudor. El interés solo aplica cuando el cliente adeuda.");
        }

        const interestCents = calcInterestCents(balance, settings.interestRatePercent);
        if (interestCents <= 0n) {
            throw new Error("El interés calculado es cero o negativo. Revisa la tasa configurada.");
        }

        const cycle = settings.paymentCycleType ?? "monthly";
        const cycleLabel = cycle === "biweekly" ? "quincenal" : cycle === "weekly" ? "semanal" : "mensual";
        const dateStr = new Date().toISOString().slice(0, 10);
        const ref = `INT-${dateStr.replace(/-/g, "")}`;
        const desc = `Interés ${cycleLabel} ${settings.interestRatePercent}% — ${dateStr}`;

        const entry = await recordEntry({
            clientId,
            entityId,
            movementType: "CHARGE",
            amountCents: interestCents,
            createdById: userId,
            reference: ref,
            description: desc,
            metadata: {
                type: "INTEREST",
                ratePercent: settings.interestRatePercent,
                cycleType: cycle,
                baseCents: balance.toString(),
            } as never,
        });

        revalidatePath(`/dashboard/creditos/entities/${entityId}`);
        revalidatePath("/dashboard/creditos");

        return {
            ...serializeMotorEntry(entry) as SerializedLedgerEntry,
            interestCents: interestCents.toString(),
        };
    },
    { context: "MotorApplyInterest" }
);

/**
 * Otorga crédito a una entidad (CHARGE con metadata de tipo crédito).
 * Semánticamente igual a un cargo, pero se registra con tipo "CREDIT_GRANT"
 * en los metadatos para distinguirlo en el estado de cuenta.
 */
export const grantCredit = safeAction<
    {
        entityId: string;
        amountCents: string;
        description?: string;
        reference?: string;
    },
    SerializedLedgerEntry
>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.ledger.write");

        const entity = await prismaServer.motorEntity.findFirst({
            where: { id: input.entityId, clientId, deletedAt: null },
            select: { id: true },
        });
        if (!entity) throw new Error("Entidad no encontrada");

        const amountCents = BigInt(input.amountCents);
        if (amountCents <= 0n) throw new Error("El monto debe ser mayor a cero");

        const dateStr = new Date().toISOString().slice(0, 10);
        const ref = input.reference?.trim() || `CRED-${dateStr.replace(/-/g, "")}`;
        const desc = input.description?.trim() || `Crédito otorgado — ${dateStr}`;

        const entry = await recordEntry({
            clientId,
            entityId: input.entityId,
            movementType: "CHARGE",
            amountCents,
            createdById: userId,
            reference: ref,
            description: desc,
            metadata: { type: "CREDIT_GRANT" } as never,
        });

        revalidatePath(`/dashboard/creditos/entities/${input.entityId}`);
        revalidatePath("/dashboard/creditos");

        return serializeMotorEntry(entry) as SerializedLedgerEntry;
    },
    { context: "MotorGrantCredit" }
);
