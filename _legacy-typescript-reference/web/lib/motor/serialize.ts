/**
 * Serialización JSON-segura para datos del Motor.
 *
 * BigInt no es JSON-safe nativamente. Este módulo provee:
 *   - serializeMotorEntry / serializeMotorEntity: shape Plain con BigInt → string
 *   - bigIntJsonReplacer: replacer genérico para JSON.stringify
 *
 * Convención: actions del Motor convierten BigInt a string ANTES de retornar
 * al cliente. La UI re-parsea con BigInt(value) cuando necesita aritmética.
 */

import type { MotorLedgerEntry, MotorEntity } from "@prisma/client";

export type SerializedLedgerEntry = Omit<
    MotorLedgerEntry,
    "amountCents" | "runningBalanceCents"
> & {
    amountCents: string;
    runningBalanceCents: string;
};

export type SerializedMotorEntity = Omit<
    MotorEntity,
    "creditLimitCents" | "loyaltyPointsCents"
> & {
    creditLimitCents: string | null;
    loyaltyPointsCents: string;
};

export function serializeMotorEntry(entry: MotorLedgerEntry): SerializedLedgerEntry {
    return {
        ...entry,
        amountCents: entry.amountCents.toString(),
        runningBalanceCents: entry.runningBalanceCents.toString(),
    };
}

export function serializeMotorEntity(entity: MotorEntity): SerializedMotorEntity {
    return {
        ...entity,
        creditLimitCents: entity.creditLimitCents?.toString() ?? null,
        loyaltyPointsCents: entity.loyaltyPointsCents.toString(),
    };
}

/**
 * JSON.stringify replacer que convierte cualquier BigInt a string. Útil para
 * estructuras anidadas o casos ad-hoc.
 */
export function bigIntJsonReplacer(_key: string, value: unknown): unknown {
    return typeof value === "bigint" ? value.toString() : value;
}
