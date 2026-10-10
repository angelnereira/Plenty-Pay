/**
 * Validación de slugs para campos dinámicos del Motor (Schema Builder).
 *
 * Reglas:
 *   - snake_case: [a-z][a-z0-9_]*[a-z0-9]
 *   - Longitud entre 3 y 40 caracteres
 *   - No debe colisionar con RESERVED_SLUGS
 *   - Único dentro del tenant (validado vs DB en validateSlugUnique)
 *   - Inmutable una vez referenciado por entidades (validado en assertSlugIsRenamable)
 */

import { prismaServer } from "@core/database/prisma-server";

const SLUG_REGEX = /^[a-z][a-z0-9_]{1,38}[a-z0-9]$/;
const MIN_LEN = 3;
const MAX_LEN = 40;

/**
 * Lista cerrada de slugs reservados. Cubre:
 *   - columnas del sistema y core fields del Motor
 *   - keywords del ledger
 *   - namespacing y tokens peligrosos en JSONB/JS
 *
 * NOTA: ampliar con cuidado — añadir un slug aquí no migra entidades existentes
 * que ya lo usen en customFields.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
    // Identidad / sistema
    "id", "client_id", "tenant_id", "kind", "type", "slug", "label",
    "required", "options", "created_at", "updated_at", "deleted_at",
    "is_active", "sort_order", "metadata", "notes",
    // Core fields del Motor (no se pueden duplicar)
    "display_name", "document_type", "document_number",
    "primary_email", "primary_phone",
    "credit_limit_cents", "payment_due_at", "loyalty_points_cents",
    "custom_fields",
    // Ledger reservado
    "ledger", "entry", "entries", "amount", "amount_cents",
    "balance", "running_balance_cents", "movement_type", "sign",
    "reference", "compensates_entry_id", "currency",
    // Namespacing
    "motor", "admin", "super_admin", "system",
    // JS reservados peligrosos para JSONB en Node
    "__proto__", "constructor", "prototype",
]);

/**
 * Valida formato + lista de reservadas. Lanza Error si falla.
 */
export function validateSlugFormat(slug: unknown): asserts slug is string {
    if (typeof slug !== "string") {
        throw new Error("Slug debe ser string");
    }
    if (slug.length < MIN_LEN || slug.length > MAX_LEN) {
        throw new Error(`Slug debe tener entre ${MIN_LEN} y ${MAX_LEN} caracteres`);
    }
    if (!SLUG_REGEX.test(slug)) {
        throw new Error(
            "Slug debe ser snake_case: comenzar con letra, contener solo [a-z0-9_], terminar en alfanumérico"
        );
    }
    if (RESERVED_SLUGS.has(slug)) {
        throw new Error(`Slug "${slug}" está reservado por el sistema`);
    }
}

/**
 * Verifica unicidad dentro del tenant. ignoreDefinitionId permite editar
 * un FieldDefinition sin que choque consigo mismo.
 */
export async function validateSlugUnique(
    slug: string,
    clientId: string,
    ignoreDefinitionId?: string
): Promise<void> {
    const existing = await prismaServer.motorEntityFieldDefinition.findUnique({
        where: { clientId_slug: { clientId, slug } },
        select: { id: true },
    });
    if (existing && existing.id !== ignoreDefinitionId) {
        throw new Error(`Slug "${slug}" ya existe en este tenant`);
    }
}

/**
 * Bloquea cambio de slug si hay entidades cuyo customFields contiene la key.
 * Usa el operador JSONB ? (existencia de key top-level).
 */
export async function assertSlugIsRenamable(
    slug: string,
    clientId: string
): Promise<void> {
    const rows = await prismaServer.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM motor_entities
        WHERE "clientId" = ${clientId}
          AND "customFields" ? ${slug}
          AND "deletedAt" IS NULL
    `;
    const count = rows[0]?.count ?? 0n;
    if (count > 0n) {
        throw new Error(
            `No se puede modificar el slug "${slug}": está en uso por ${count.toString()} entidades`
        );
    }
}

/**
 * Conveniencia: valida formato + unicidad. Usar al crear un FieldDefinition.
 */
export async function validateNewSlug(slug: string, clientId: string): Promise<void> {
    validateSlugFormat(slug);
    await validateSlugUnique(slug, clientId);
}

/**
 * Genera un slug candidato a partir de un label humano. No garantiza unicidad
 * — el caller debe seguir validando con validateNewSlug.
 */
export function suggestSlugFromLabel(label: string): string {
    return label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // quitar acentos
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, MAX_LEN);
}
