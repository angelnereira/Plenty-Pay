/**
 * Validación de customFields contra MotorEntityFieldDefinition.
 *
 * Reglas:
 *   - Solo se aceptan keys cuyo slug existe como FieldDefinition activa
 *   - El kindScope de la definition debe permitir el kind de la entidad
 *   - Tipos: TEXT (string), NUMBER (number), DATE (ISO string), BOOLEAN (bool),
 *     SELECT (debe estar en options)
 *   - Required: si la definition es required, la key debe existir y no ser
 *     null/undefined/""
 *
 * Estrategia: este motor opera sobre el OBJETO completo (en vez de validar
 * field-by-field) para detectar required missing y campos fantasma.
 */

import type {
    MotorEntityFieldDefinition,
    MotorEntityKind,
    MotorFieldType,
    MotorFieldKindScope,
} from "@prisma/client";

export type CustomFieldValue = string | number | boolean | null;
export type CustomFieldsPayload = Record<string, CustomFieldValue>;

interface FieldOption {
    value: string;
    label: string;
}

function isFieldOptionArray(value: unknown): value is FieldOption[] {
    return (
        Array.isArray(value) &&
        value.every(
            (item) =>
                item != null &&
                typeof item === "object" &&
                typeof (item as Record<string, unknown>).value === "string"
        )
    );
}

function scopeAllowsKind(scope: MotorFieldKindScope, kind: MotorEntityKind): boolean {
    if (scope === "BOTH") return true;
    return scope === kind;
}

function validateValueForType(
    slug: string,
    value: CustomFieldValue,
    type: MotorFieldType,
    options: unknown
): void {
    if (value === null || value === undefined) return;
    switch (type) {
        case "TEXT":
            if (typeof value !== "string") {
                throw new Error(`Campo "${slug}": se esperaba TEXT (string)`);
            }
            return;
        case "NUMBER":
            if (typeof value !== "number" || !Number.isFinite(value)) {
                throw new Error(`Campo "${slug}": se esperaba NUMBER finito`);
            }
            return;
        case "BOOLEAN":
            if (typeof value !== "boolean") {
                throw new Error(`Campo "${slug}": se esperaba BOOLEAN`);
            }
            return;
        case "DATE": {
            if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
                throw new Error(`Campo "${slug}": se esperaba DATE (ISO string)`);
            }
            return;
        }
        case "SELECT": {
            if (typeof value !== "string") {
                throw new Error(`Campo "${slug}": SELECT debe ser string`);
            }
            if (!isFieldOptionArray(options)) {
                throw new Error(`Campo "${slug}": configuración de opciones inválida`);
            }
            const validValues = options.map((o) => o.value);
            if (!validValues.includes(value)) {
                throw new Error(
                    `Campo "${slug}": valor "${value}" no está en las opciones permitidas`
                );
            }
            return;
        }
        default: {
            const _exhaustive: never = type;
            void _exhaustive;
        }
    }
}

/**
 * Valida un payload de customFields contra el schema activo del tenant.
 * @returns el payload validado (con keys desconocidas eliminadas si stripUnknown=true)
 */
export function validateCustomFields(
    payload: CustomFieldsPayload | null | undefined,
    definitions: MotorEntityFieldDefinition[],
    kind: MotorEntityKind,
    options?: { stripUnknown?: boolean }
): CustomFieldsPayload {
    const input = payload ?? {};
    const stripUnknown = options?.stripUnknown ?? true;
    const activeDefs = definitions.filter(
        (d) => d.isActive && scopeAllowsKind(d.kindScope, kind)
    );
    const defBySlug = new Map(activeDefs.map((d) => [d.slug, d]));

    // Required: cada definition requerida debe tener un valor presente
    for (const def of activeDefs) {
        if (!def.required) continue;
        const v = input[def.slug];
        if (v === undefined || v === null || v === "") {
            throw new Error(`Campo requerido faltante: "${def.slug}"`);
        }
    }

    const validated: CustomFieldsPayload = {};
    for (const [slug, value] of Object.entries(input)) {
        const def = defBySlug.get(slug);
        if (!def) {
            if (stripUnknown) continue;
            throw new Error(`Campo desconocido: "${slug}"`);
        }
        validateValueForType(slug, value, def.type, def.options);
        validated[slug] = value;
    }
    return validated;
}
