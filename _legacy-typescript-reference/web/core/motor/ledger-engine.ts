/**
 * Ledger engine append-only del Motor.
 *
 * Garantías:
 *   - Aritmética exacta en BigInt (sin redondeos JS)
 *   - Concurrencia segura: SELECT ... FOR UPDATE sobre la fila de la entidad
 *     antes de leer el balance previo (serializa escritores concurrentes)
 *   - runningBalanceCents denormalizado: lookup O(1) por la última fila
 *   - Inmutabilidad: triggers Postgres bloquean UPDATE/DELETE (ver migration.sql)
 *   - Reversiones idempotentes: un mismo originalEntryId solo genera UNA
 *     entrada compensatoria
 *   - SIEMPRE clientId como primer filtro
 */

import { Prisma } from "@prisma/client";
import type { MotorLedgerEntry, MotorMovementType, MotorLedgerSign } from "@prisma/client";
import { prismaServer } from "@core/database/prisma-server";

const SIGN_MAP: Record<MotorMovementType, MotorLedgerSign> = {
    CHARGE: "NEGATIVE",
    ADJUSTMENT_DEBIT: "NEGATIVE",
    LOYALTY_REDEEM: "NEGATIVE",
    PAYMENT: "POSITIVE",
    ADJUSTMENT_CREDIT: "POSITIVE",
    LOYALTY_GRANT: "POSITIVE",
};

const INVERSE: Record<MotorMovementType, MotorMovementType> = {
    CHARGE: "ADJUSTMENT_CREDIT",
    PAYMENT: "ADJUSTMENT_DEBIT",
    ADJUSTMENT_CREDIT: "ADJUSTMENT_DEBIT",
    ADJUSTMENT_DEBIT: "ADJUSTMENT_CREDIT",
    LOYALTY_GRANT: "LOYALTY_REDEEM",
    LOYALTY_REDEEM: "LOYALTY_GRANT",
};

export interface RecordEntryInput {
    clientId: string;
    entityId: string;
    movementType: MotorMovementType;
    amountCents: bigint;
    createdById: string;
    reference?: string;
    description?: string;
    metadata?: Prisma.InputJsonValue;
    compensatesEntryId?: string;
}

/**
 * Saldo actual de una entidad. Negativo = adeuda al tenant.
 * Positivo = saldo a favor.
 */
export async function getEntityBalance(clientId: string, entityId: string): Promise<bigint> {
    const last = await prismaServer.motorLedgerEntry.findFirst({
        where: { clientId, entityId },
        orderBy: { createdAt: "desc" },
        select: { runningBalanceCents: true },
    });
    return last?.runningBalanceCents ?? 0n;
}

/**
 * Valida que un cargo no exceda el límite de crédito de la entidad.
 * Solo se ejecuta cuando movementType=CHARGE (los pagos siempre suman).
 * Debe correr DENTRO de una transacción que ya hizo SELECT FOR UPDATE.
 */
async function validateCreditLimitInTx(
    tx: Prisma.TransactionClient,
    clientId: string,
    entityId: string,
    signedDeltaCents: bigint
): Promise<void> {
    const entity = await tx.motorEntity.findFirstOrThrow({
        where: { id: entityId, clientId, deletedAt: null },
        select: { creditLimitCents: true },
    });
    if (entity.creditLimitCents == null) return;
    const last = await tx.motorLedgerEntry.findFirst({
        where: { clientId, entityId },
        orderBy: { createdAt: "desc" },
        select: { runningBalanceCents: true },
    });
    const previous = last?.runningBalanceCents ?? 0n;
    const projected = previous + signedDeltaCents;
    if (projected < -entity.creditLimitCents) {
        throw new Error(
            `Límite de crédito excedido (saldo proyectado ${projected.toString()}, límite -${entity.creditLimitCents.toString()})`
        );
    }
}

/**
 * Registra una entrada del ledger. Es la única vía aprobada para escribir
 * en motor_ledger_entries — los triggers DB bloquean cualquier UPDATE/DELETE.
 *
 * @throws si amountCents <= 0
 * @throws si la entidad no existe / fue soft-deleted
 * @throws si CHARGE excede el límite de crédito
 */
export async function recordEntry(input: RecordEntryInput): Promise<MotorLedgerEntry> {
    if (input.amountCents <= 0n) {
        throw new Error("amountCents debe ser positivo");
    }
    const sign = SIGN_MAP[input.movementType];
    const delta = sign === "POSITIVE" ? input.amountCents : -input.amountCents;

    return prismaServer.$transaction(
        async (tx) => {
            // Lock fila de la entidad para serializar escritores concurrentes
            await tx.$queryRaw`
                SELECT "id" FROM "motor_entities"
                WHERE "id" = ${input.entityId}
                  AND "clientId" = ${input.clientId}
                  AND "deletedAt" IS NULL
                FOR UPDATE
            `;

            if (input.movementType === "CHARGE") {
                await validateCreditLimitInTx(tx, input.clientId, input.entityId, delta);
            }

            const last = await tx.motorLedgerEntry.findFirst({
                where: { clientId: input.clientId, entityId: input.entityId },
                orderBy: { createdAt: "desc" },
                select: { runningBalanceCents: true },
            });
            const previous = last?.runningBalanceCents ?? 0n;
            const newBalance = previous + delta;

            const entry = await tx.motorLedgerEntry.create({
                data: {
                    clientId: input.clientId,
                    entityId: input.entityId,
                    movementType: input.movementType,
                    sign,
                    amountCents: input.amountCents,
                    runningBalanceCents: newBalance,
                    reference: input.reference,
                    description: input.description,
                    metadata: input.metadata,
                    compensatesEntryId: input.compensatesEntryId,
                    createdById: input.createdById,
                },
            });

            // Mantener loyaltyPointsCents denormalizado para UI
            if (input.movementType === "LOYALTY_GRANT" || input.movementType === "LOYALTY_REDEEM") {
                await tx.motorEntity.update({
                    where: { id: input.entityId },
                    data: {
                        loyaltyPointsCents: {
                            increment:
                                input.movementType === "LOYALTY_GRANT"
                                    ? input.amountCents
                                    : -input.amountCents,
                        },
                    },
                });
            }
            return entry;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
}

/**
 * Genera una entrada compensatoria que reversa otra. Idempotente: si ya
 * existe un compensatorio para originalEntryId, retorna el existente.
 */
export async function recordCompensatingEntry(
    clientId: string,
    originalEntryId: string,
    reason: string,
    createdById: string
): Promise<MotorLedgerEntry> {
    const existing = await prismaServer.motorLedgerEntry.findFirst({
        where: { clientId, compensatesEntryId: originalEntryId },
    });
    if (existing) return existing;

    const original = await prismaServer.motorLedgerEntry.findFirstOrThrow({
        where: { id: originalEntryId, clientId },
    });
    return recordEntry({
        clientId: original.clientId,
        entityId: original.entityId,
        movementType: INVERSE[original.movementType],
        amountCents: original.amountCents,
        createdById,
        description: `Reverso: ${reason}`,
        compensatesEntryId: originalEntryId,
        reference: original.reference ?? undefined,
    });
}

/**
 * Estado de cuenta paginado de una entidad. clientId-first.
 */
export async function getStatementOfAccount(
    clientId: string,
    entityId: string,
    options?: { limit?: number; cursor?: string }
): Promise<{ entries: MotorLedgerEntry[]; nextCursor: string | null }> {
    const limit = Math.min(options?.limit ?? 50, 200);
    const entries = await prismaServer.motorLedgerEntry.findMany({
        where: { clientId, entityId },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    });
    const hasMore = entries.length > limit;
    const sliced = hasMore ? entries.slice(0, limit) : entries;
    return {
        entries: sliced,
        nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
    };
}

export { SIGN_MAP, INVERSE };
