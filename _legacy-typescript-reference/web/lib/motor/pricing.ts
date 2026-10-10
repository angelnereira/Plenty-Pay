/**
 * Pricing por tiers del Módulo de Créditos.
 *
 * El módulo se vende en 3 escalas dimensionadas por # de clientes con
 * crédito otorgado simultáneamente. Definición operativa de "cliente con
 * crédito":
 *
 *   MotorEntity con deletedAt IS NULL
 *                  AND isActive = true
 *                  AND creditLimitCents IS NOT NULL
 *
 * Saldo distinto de cero NO suma; abrir crédito sí. Coincide con la
 * intuición comercial de "a cuántos clientes les diste línea".
 *
 * Bloqueo duro al exceder el límite del tier — exigido en createEntity,
 * updateEntity y cuando se reactiva una entidad con crédito previo.
 */

import { MotorCreditTier } from "@prisma/client";
import { prismaServer } from "@core/database/prisma-server";
import { ADDON_CATALOG, formatCents } from "@/lib/constants/plans";

export interface MotorTierSpec {
    readonly tier: MotorCreditTier;
    readonly limitClientsWithCredit: number;
    readonly priceCents: bigint;
    readonly label: string;
    readonly priceLabel: string;
}

// MOTOR_TIERS deriva del catálogo (lib/constants/plans.ts) para evitar
// duplicación. Los precios viven en ADDON_CATALOG.creditos.pricing.tiers.
const _creditosPricing = ADDON_CATALOG.creditos.pricing;
if (_creditosPricing.kind !== "tiered") {
    throw new Error("ADDON_CATALOG.creditos.pricing debe ser tiered");
}
const _tiers = _creditosPricing.tiers;

export const MOTOR_TIERS: Record<MotorCreditTier, MotorTierSpec> = {
    TIER_1: {
        tier: "TIER_1",
        limitClientsWithCredit: _tiers.TIER_1.limit,
        priceCents: BigInt(_tiers.TIER_1.priceCents),
        label: _tiers.TIER_1.label,
        priceLabel: `${formatCents(_tiers.TIER_1.priceCents)} / mes`,
    },
    TIER_2: {
        tier: "TIER_2",
        limitClientsWithCredit: _tiers.TIER_2.limit,
        priceCents: BigInt(_tiers.TIER_2.priceCents),
        label: _tiers.TIER_2.label,
        priceLabel: `${formatCents(_tiers.TIER_2.priceCents)} / mes`,
    },
    TIER_3: {
        tier: "TIER_3",
        limitClientsWithCredit: _tiers.TIER_3.limit,
        priceCents: BigInt(_tiers.TIER_3.priceCents),
        label: _tiers.TIER_3.label,
        priceLabel: `${formatCents(_tiers.TIER_3.priceCents)} / mes`,
    },
};

export const MOTOR_TIER_ORDER: readonly MotorCreditTier[] = ["TIER_1", "TIER_2", "TIER_3"];

export async function getCurrentMotorUsage(clientId: string): Promise<number> {
    return prismaServer.motorEntity.count({
        where: {
            clientId,
            deletedAt: null,
            isActive: true,
            creditLimitCents: { not: null },
        },
    });
}

export interface MotorTierUsage {
    used: number;
    limit: number;
    tier: MotorCreditTier;
    label: string;
    priceLabel: string;
    nearLimit: boolean; // ≥ 80% del cupo
}

export async function getMotorTierUsage(clientId: string): Promise<MotorTierUsage | null> {
    const client = await prismaServer.client.findUnique({
        where: { id: clientId },
        select: { motorCreditTier: true, creditosEnabled: true },
    });
    if (!client?.creditosEnabled || !client.motorCreditTier) return null;
    const spec = MOTOR_TIERS[client.motorCreditTier];
    const used = await getCurrentMotorUsage(clientId);
    return {
        used,
        limit: spec.limitClientsWithCredit,
        tier: spec.tier,
        label: spec.label,
        priceLabel: spec.priceLabel,
        nearLimit: used / spec.limitClientsWithCredit >= 0.8,
    };
}

/**
 * Lanza si el tenant excede el límite del tier asignado, o si el módulo
 * no está activo. Llamar antes de cualquier mutación que abra una nueva
 * línea de crédito (createEntity con creditLimit, updateEntity que añade
 * creditLimit, reactivación de entidad con creditLimit).
 */
export async function assertWithinTierLimit(clientId: string): Promise<void> {
    const client = await prismaServer.client.findUnique({
        where: { id: clientId },
        select: { motorCreditTier: true, creditosEnabled: true },
    });
    if (!client) throw new Error("Tenant no encontrado");
    if (!client.creditosEnabled || !client.motorCreditTier) {
        throw new Error(
            "El Módulo de Créditos no está activo para este tenant. Solicita activación al administrador."
        );
    }
    const spec = MOTOR_TIERS[client.motorCreditTier];
    const used = await getCurrentMotorUsage(clientId);
    if (used >= spec.limitClientsWithCredit) {
        throw new Error(
            `Excediste el límite del plan (${spec.label}, ${used}/${spec.limitClientsWithCredit} clientes con crédito). ` +
                `Sube de tier para abrir crédito a más clientes.`
        );
    }
}

/**
 * Valida que un downgrade de tier sea posible (uso actual ≤ nuevo límite).
 * Llamar desde la acción admin de cambio de tier antes de persistir.
 */
export async function assertCanChangeTier(
    clientId: string,
    targetTier: MotorCreditTier
): Promise<void> {
    const target = MOTOR_TIERS[targetTier];
    const used = await getCurrentMotorUsage(clientId);
    if (used > target.limitClientsWithCredit) {
        const exceso = used - target.limitClientsWithCredit;
        throw new Error(
            `No puedes cambiar a ${target.label}: actualmente hay ${used} clientes con crédito, ` +
                `máximo permitido ${target.limitClientsWithCredit}. ` +
                `Desactiva o quita el crédito de ${exceso} cliente(s) primero.`
        );
    }
}
