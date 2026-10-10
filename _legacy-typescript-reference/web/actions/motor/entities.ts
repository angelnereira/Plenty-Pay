"use server";

/**
 * Server Actions: gestión de MotorEntity (CRUD + relaciones).
 *
 * Todas las queries empiezan por clientId. Soft-delete via deletedAt.
 * Las creaciones ↔ actualizaciones validan customFields contra el Schema
 * Builder (motor_entity_field_definitions).
 */

import { safeAction } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { prismaServer } from "@core/database/prisma-server";
import { getMotorPanelContext } from "@/lib/motor/context";

import { centsFromString } from "@/lib/motor/money";
import { serializeMotorEntity, type SerializedMotorEntity } from "@/lib/motor/serialize";
import { validateCustomFields, type CustomFieldsPayload } from "@core/motor/field-engine";
import { assertWithinTierLimit } from "@/lib/motor/pricing";
import type { MotorEntityKind } from "@prisma/client";

/** Fecha local YYYY-MM-DD o ISO; vacío → null */
function parsePaymentDueAt(raw: string | null | undefined): Date | null {
    if (raw == null || !String(raw).trim()) return null;
    const s = String(raw).trim().slice(0, 10);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

interface ExtendedEntityData {
    address?: {
        province?: string;
        area?: string;
        street?: string;
    };
    employment?: {
        workplace?: string;
        position?: string;
        salaryAmount?: string;
        salaryFrequency?: string;
    };
    creditSettings?: {
        interestRatePercent?: string;
        paymentCycleType?: string;
        paymentCycleDayOfMonth?: number;
    };
    references?: Array<{
        name: string;
        phone: string;
        relationship: string;
    }>;
    guarantor?: {
        name?: string;
        phone?: string;
        documentType?: string;
        documentNumber?: string;
    };
}

interface CreateEntityInput {
    kind: MotorEntityKind;
    displayName: string;
    documentType?: string | null;
    documentNumber?: string | null;
    primaryEmail?: string | null;
    primaryPhone?: string | null;
    creditLimitCents?: string | null; // BigInt-as-string
    /** YYYY-MM-DD o ISO; vacío = sin fecha tope */
    paymentDueAt?: string | null;
    customFields?: CustomFieldsPayload;
    extendedData?: ExtendedEntityData;
}

export const createEntity = safeAction<CreateEntityInput, SerializedMotorEntity>(
    async (input) => {
        const { clientId } = await getMotorPanelContext();

        if (!input.displayName || input.displayName.trim().length < 2) {
            throw new Error("displayName requerido (mín 2 caracteres)");
        }

        const definitions = await prismaServer.motorEntityFieldDefinition.findMany({
            where: { clientId, isActive: true },
        });
        const validatedCustomFields = validateCustomFields(
            input.customFields,
            definitions,
            input.kind
        );

        const mergedCustomFields: Record<string, unknown> = { ...validatedCustomFields };
        if (input.extendedData) {
            mergedCustomFields._ext = input.extendedData;
        }

        const creditLimitCents = centsFromString(input.creditLimitCents ?? null);
        // Pricing tier: si esta entidad abre una nueva línea de crédito,
        // el tenant no puede exceder el límite de su tier.
        if (creditLimitCents != null) {
            await assertWithinTierLimit(clientId);
        }

        const entity = await prismaServer.motorEntity.create({
            data: {
                clientId,
                kind: input.kind,
                displayName: input.displayName.trim(),
                documentType: input.documentType ?? null,
                documentNumber: input.documentNumber ?? null,
                primaryEmail: input.primaryEmail ?? null,
                primaryPhone: input.primaryPhone ?? null,
                creditLimitCents,
                paymentDueAt: parsePaymentDueAt(input.paymentDueAt),
                customFields:
                    Object.keys(mergedCustomFields).length > 0
                        ? (mergedCustomFields as Parameters<typeof prismaServer.motorEntity.create>[0]["data"]["customFields"])
                        : undefined,
            },
        });

        revalidatePath("/dashboard/creditos");
        return serializeMotorEntity(entity);
    },
    { context: "MotorCreateEntity" }
);

interface UpdateEntityInput {
    id: string;
    displayName?: string;
    documentType?: string | null;
    documentNumber?: string | null;
    primaryEmail?: string | null;
    primaryPhone?: string | null;
    isActive?: boolean;
    creditLimitCents?: string | null;
    paymentDueAt?: string | null;
    customFields?: CustomFieldsPayload;
}

export const updateEntity = safeAction<UpdateEntityInput, SerializedMotorEntity>(
    async (input) => {
        const { clientId } = await getMotorPanelContext();

        const existing = await prismaServer.motorEntity.findFirst({
            where: { id: input.id, clientId, deletedAt: null },
        });
        if (!existing) throw new Error("Entidad no encontrada");

        let validatedCustomFields: CustomFieldsPayload | undefined;
        if (input.customFields !== undefined) {
            const definitions = await prismaServer.motorEntityFieldDefinition.findMany({
                where: { clientId, isActive: true },
            });
            validatedCustomFields = validateCustomFields(
                input.customFields,
                definitions,
                existing.kind
            );
        }

        // Pricing tier: bloquear si la mutación abre una nueva línea de
        // crédito (creditLimit null → not-null) o si reactiva una entidad
        // que ya tenía crédito otorgado.
        const nextCreditLimit =
            input.creditLimitCents !== undefined
                ? centsFromString(input.creditLimitCents)
                : existing.creditLimitCents;
        const nextIsActive = input.isActive ?? existing.isActive;
        const wasCountingAsCreditClient =
            existing.creditLimitCents != null && existing.isActive && existing.deletedAt == null;
        const willCountAsCreditClient = nextCreditLimit != null && nextIsActive;
        if (willCountAsCreditClient && !wasCountingAsCreditClient) {
            await assertWithinTierLimit(clientId);
        }

        const entity = await prismaServer.motorEntity.update({
            where: { id: input.id },
            data: {
                displayName: input.displayName?.trim() ?? undefined,
                documentType: input.documentType ?? undefined,
                documentNumber: input.documentNumber ?? undefined,
                primaryEmail: input.primaryEmail ?? undefined,
                primaryPhone: input.primaryPhone ?? undefined,
                isActive: input.isActive ?? undefined,
                creditLimitCents:
                    input.creditLimitCents !== undefined
                        ? centsFromString(input.creditLimitCents)
                        : undefined,
                paymentDueAt:
                    input.paymentDueAt !== undefined
                        ? parsePaymentDueAt(input.paymentDueAt)
                        : undefined,
                customFields: validatedCustomFields,
            },
        });

        revalidatePath("/dashboard/creditos");
        revalidatePath(`/dashboard/creditos/entities/${input.id}`);
        return serializeMotorEntity(entity);
    },
    { context: "MotorUpdateEntity" }
);

export const softDeleteEntity = safeAction<{ id: string }, { id: string }>(
    async ({ id }) => {
        const { clientId } = await getMotorPanelContext();

        const existing = await prismaServer.motorEntity.findFirst({
            where: { id, clientId, deletedAt: null },
        });
        if (!existing) throw new Error("Entidad no encontrada");

        await prismaServer.motorEntity.update({
            where: { id },
            data: { deletedAt: new Date(), isActive: false },
        });
        revalidatePath("/dashboard/creditos");
        return { id };
    },
    { context: "MotorSoftDeleteEntity" }
);

interface AddRelationInput {
    fromEntityId: string;
    toEntityId: string;
    relationType: string;
    metadata?: Record<string, unknown>;
}

export const addEntityRelation = safeAction<AddRelationInput, { id: string }>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();

        if (input.fromEntityId === input.toEntityId) {
            throw new Error("Una entidad no puede relacionarse consigo misma");
        }
        const slug = input.relationType.trim().toLowerCase().replace(/\s+/g, "_");
        if (!/^[a-z][a-z0-9_]{1,38}[a-z0-9]$/.test(slug)) {
            throw new Error("relationType inválido (snake_case 3-40 chars)");
        }

        // Ambas entidades deben existir y pertenecer al tenant
        const count = await prismaServer.motorEntity.count({
            where: {
                clientId,
                deletedAt: null,
                id: { in: [input.fromEntityId, input.toEntityId] },
            },
        });
        if (count !== 2) throw new Error("Una o ambas entidades no existen en este tenant");

        const rel = await prismaServer.motorEntityRelation.create({
            data: {
                clientId,
                fromEntityId: input.fromEntityId,
                toEntityId: input.toEntityId,
                relationType: slug,
                metadata: input.metadata as never,
                createdById: userId,
            },
        });
        revalidatePath(`/dashboard/creditos/entities/${input.fromEntityId}`);
        return { id: rel.id };
    },
    { context: "MotorAddEntityRelation" }
);

export const removeEntityRelation = safeAction<{ id: string }, { id: string }>(
    async ({ id }) => {
        const { clientId } = await getMotorPanelContext();
        const rel = await prismaServer.motorEntityRelation.findFirst({
            where: { id, clientId },
        });
        if (!rel) throw new Error("Relación no encontrada");
        await prismaServer.motorEntityRelation.delete({ where: { id } });
        revalidatePath(`/dashboard/creditos/entities/${rel.fromEntityId}`);
        return { id };
    },
    { context: "MotorRemoveEntityRelation" }
);
