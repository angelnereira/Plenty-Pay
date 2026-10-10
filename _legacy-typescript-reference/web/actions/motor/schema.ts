"use server";

/**
 * Server Actions: Schema Builder de campos dinámicos para entidades del Motor.
 *
 * El slug de un FieldDefinition es:
 *   - inmutable una vez referenciado por entidades (validado en update)
 *   - único dentro del tenant
 *   - validado contra RESERVED_SLUGS
 */

import { safeAction } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { prismaServer } from "@core/database/prisma-server";
import { getMotorPanelContext } from "@/lib/motor/context";
import { assertMotorPermission } from "@/lib/motor/permissions";
import {
    validateNewSlug,
    validateSlugFormat,
    assertSlugIsRenamable,
} from "@/lib/motor/slug";
import type { MotorFieldType, MotorFieldKindScope, MotorEntityFieldDefinition } from "@prisma/client";

interface CreateFieldDefinitionInput {
    slug: string;
    label: string;
    type: MotorFieldType;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    kindScope?: MotorFieldKindScope;
    sortOrder?: number;
    notes?: string;
}

export const createFieldDefinition = safeAction<
    CreateFieldDefinitionInput,
    MotorEntityFieldDefinition
>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.schema.manage");

        validateSlugFormat(input.slug);
        await validateNewSlug(input.slug, clientId);

        if (!input.label || input.label.trim().length < 2) {
            throw new Error("label requerido (mín 2 caracteres)");
        }
        if (input.type === "SELECT") {
            if (!input.options || input.options.length === 0) {
                throw new Error("SELECT requiere al menos una opción");
            }
            const seen = new Set<string>();
            for (const opt of input.options) {
                if (!opt.value || !opt.label) throw new Error("Cada opción requiere value y label");
                if (seen.has(opt.value)) throw new Error(`Opción duplicada: ${opt.value}`);
                seen.add(opt.value);
            }
        }

        const def = await prismaServer.motorEntityFieldDefinition.create({
            data: {
                clientId,
                slug: input.slug,
                label: input.label.trim(),
                type: input.type,
                required: input.required ?? false,
                options: input.type === "SELECT" ? (input.options as never) : undefined,
                kindScope: input.kindScope ?? "BOTH",
                sortOrder: input.sortOrder ?? 0,
                notes: input.notes,
            },
        });
        revalidatePath("/dashboard/creditos/schema");
        return def;
    },
    { context: "MotorCreateFieldDefinition" }
);

interface UpdateFieldDefinitionInput {
    id: string;
    label?: string;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    kindScope?: MotorFieldKindScope;
    sortOrder?: number;
    notes?: string;
    // slug NO es editable salvo que no haya entidades referenciándolo
    newSlug?: string;
}

export const updateFieldDefinition = safeAction<
    UpdateFieldDefinitionInput,
    MotorEntityFieldDefinition
>(
    async (input) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.schema.manage");

        const existing = await prismaServer.motorEntityFieldDefinition.findFirst({
            where: { id: input.id, clientId },
        });
        if (!existing) throw new Error("Definition no encontrada");

        let nextSlug = existing.slug;
        if (input.newSlug && input.newSlug !== existing.slug) {
            validateSlugFormat(input.newSlug);
            await assertSlugIsRenamable(existing.slug, clientId);
            // Asegurar que el nuevo slug no choque
            const collision = await prismaServer.motorEntityFieldDefinition.findUnique({
                where: { clientId_slug: { clientId, slug: input.newSlug } },
                select: { id: true },
            });
            if (collision && collision.id !== existing.id) {
                throw new Error(`Slug "${input.newSlug}" ya existe`);
            }
            nextSlug = input.newSlug;
        }

        if (input.options) {
            if (existing.type !== "SELECT") {
                throw new Error("options solo aplica a tipo SELECT");
            }
            const seen = new Set<string>();
            for (const opt of input.options) {
                if (!opt.value || !opt.label) throw new Error("Cada opción requiere value y label");
                if (seen.has(opt.value)) throw new Error(`Opción duplicada: ${opt.value}`);
                seen.add(opt.value);
            }
        }

        const def = await prismaServer.motorEntityFieldDefinition.update({
            where: { id: input.id },
            data: {
                slug: nextSlug,
                label: input.label?.trim() ?? undefined,
                required: input.required ?? undefined,
                options: input.options ? (input.options as never) : undefined,
                kindScope: input.kindScope ?? undefined,
                sortOrder: input.sortOrder ?? undefined,
                notes: input.notes ?? undefined,
            },
        });
        revalidatePath("/dashboard/creditos/schema");
        return def;
    },
    { context: "MotorUpdateFieldDefinition" }
);

export const deactivateFieldDefinition = safeAction<{ id: string }, { id: string }>(
    async ({ id }) => {
        const { clientId, userId } = await getMotorPanelContext();
        await assertMotorPermission(userId, clientId, "motor.schema.manage");

        const existing = await prismaServer.motorEntityFieldDefinition.findFirst({
            where: { id, clientId },
        });
        if (!existing) throw new Error("Definition no encontrada");

        await prismaServer.motorEntityFieldDefinition.update({
            where: { id },
            data: { isActive: false },
        });
        revalidatePath("/dashboard/creditos/schema");
        return { id };
    },
    { context: "MotorDeactivateFieldDefinition" }
);
