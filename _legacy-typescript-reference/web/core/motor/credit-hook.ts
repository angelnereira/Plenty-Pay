/**
 * Hook universal del Motor para facturación.
 *
 * v1.1: el Motor es infraestructura universal — siempre corre, sin gate
 * de tenant. Funciones:
 *
 *   1. Sincronización implícita de entidades (siempre): crear/actualizar
 *      MotorEntity desde el receptor de la factura. Dedupe por
 *      (clientId, documentNumber) y fallback por email. Idempotente.
 *
 *   2. Cargo automático a crédito (si paymentTerm="CREDIT"): registrar
 *      CHARGE en el ledger para la entidad. Idempotente vía reference.
 *
 * Best-effort: errores se loguean pero nunca propagan al flujo de
 * facturación o POS.
 */

import { prismaServer } from "@core/database/prisma-server";
import { recordEntry } from "@core/motor/ledger-engine";
import { toCents } from "@/lib/motor/money";
import type { MotorEntity, MotorEntityKind } from "@prisma/client";

const HOOK_REFERENCE_PREFIX = "invoice:";

interface InvoiceMinimum {
    id: string;
    clientId: string;
    paymentTerm: string;
    total: { toString(): string }; // Prisma.Decimal
    invoiceNumber: string | null;
    customerId: string | null;
    receiverRuc: string | null;
    receiverDv: string | null;
    receiverName: string;
    receiverEmail: string | null;
    receiverPhone: string | null;
    createdBy: string;
}

/**
 * Punto de entrada principal — llamar después de persistir cualquier
 * factura (manual o POS), independientemente del término de pago.
 *
 * Hace dos cosas:
 *   1) Sincroniza el receptor a MotorEntity (universal, idempotente).
 *   2) Si paymentTerm="CREDIT", registra el cargo en el ledger.
 */
export async function processInvoiceForMotor(invoiceId: string): Promise<void> {
    try {
        const invoice = await prismaServer.invoice.findUnique({
            where: { id: invoiceId },
            select: {
                id: true,
                clientId: true,
                paymentTerm: true,
                total: true,
                invoiceNumber: true,
                customerId: true,
                receiverRuc: true,
                receiverDv: true,
                receiverName: true,
                receiverEmail: true,
                receiverPhone: true,
                createdBy: true,
            },
        });
        if (!invoice) return;

        // 1) Sync universal de entidad
        const entity = await syncEntityFromInvoice(invoice);
        if (!entity) return;

        // 2) Cargo a crédito (si aplica)
        if (invoice.paymentTerm?.toUpperCase() === "CREDIT") {
            await recordCreditChargeIfNeeded(invoice, entity.id);
        }
    } catch (err) {
        console.error("[MotorHook] Error procesando factura:", err);
    }
}

/**
 * Compatibilidad con código v1.0 — alias del flujo completo.
 * @deprecated v1.1 — usar processInvoiceForMotor.
 */
export async function recordCreditChargeFromInvoice(invoiceId: string): Promise<void> {
    return processInvoiceForMotor(invoiceId);
}

interface ResolvedEntity {
    id: string;
}

/**
 * Sincroniza/upsertea una MotorEntity desde el receptor de una factura.
 * Dedupe por (clientId, documentNumber) primero, luego por email.
 * Si encuentra match, actualiza datos faltantes. Si no, crea.
 */
async function syncEntityFromInvoice(invoice: InvoiceMinimum): Promise<ResolvedEntity | null> {
    const docNumber = invoice.receiverRuc?.trim() || null;
    const email = invoice.receiverEmail?.trim().toLowerCase() || null;
    const phone = invoice.receiverPhone?.trim() || null;

    let existing: MotorEntity | null = null;

    // 1) Match por documento
    if (docNumber) {
        existing = await prismaServer.motorEntity.findFirst({
            where: {
                clientId: invoice.clientId,
                documentNumber: docNumber,
                deletedAt: null,
            },
        });
    }

    // 2) Match por email si no hay doc-match
    if (!existing && email && !docNumber) {
        existing = await prismaServer.motorEntity.findFirst({
            where: {
                clientId: invoice.clientId,
                primaryEmail: email,
                deletedAt: null,
            },
        });
    }

    // Si existe, hidratar campos vacíos sin sobrescribir lo que ya hay
    if (existing) {
        const patch: {
            primaryEmail?: string;
            primaryPhone?: string;
            documentNumber?: string;
            documentType?: string;
        } = {};
        if (!existing.primaryEmail && email) patch.primaryEmail = email;
        if (!existing.primaryPhone && phone) patch.primaryPhone = phone;
        if (!existing.documentNumber && docNumber) patch.documentNumber = docNumber;
        if (!existing.documentType && docNumber) {
            patch.documentType = existing.kind === "COMPANY" ? "RUC" : "CEDULA";
        }
        if (Object.keys(patch).length > 0) {
            await prismaServer.motorEntity.update({
                where: { id: existing.id },
                data: patch,
            });
        }
        return { id: existing.id };
    }

    // 3) Auto-crear desde Customer (si está enlazado) o desde datos de la factura
    let kind: MotorEntityKind = "COMPANY";
    if (invoice.customerId) {
        const customer = await prismaServer.customer.findUnique({
            where: { id: invoice.customerId },
            select: { rucType: true },
        });
        if (customer) {
            kind = customer.rucType === "1" ? "PERSON" : "COMPANY";
        }
    } else {
        kind = !docNumber || docNumber.length <= 11 ? "PERSON" : "COMPANY";
    }

    const created = await prismaServer.motorEntity.create({
        data: {
            clientId: invoice.clientId,
            kind,
            displayName: invoice.receiverName,
            documentType: docNumber ? (kind === "COMPANY" ? "RUC" : "CEDULA") : null,
            documentNumber: docNumber,
            primaryEmail: email,
            primaryPhone: phone,
        },
        select: { id: true },
    });
    return created;
}

/**
 * Registra un CHARGE en el ledger por una factura a crédito.
 * Idempotente vía reference="invoice:{invoiceId}".
 */
async function recordCreditChargeIfNeeded(
    invoice: InvoiceMinimum,
    entityId: string
): Promise<void> {
    const reference = `${HOOK_REFERENCE_PREFIX}${invoice.id}`;

    const existing = await prismaServer.motorLedgerEntry.findFirst({
        where: {
            clientId: invoice.clientId,
            movementType: "CHARGE",
            reference,
        },
        select: { id: true },
    });
    if (existing) return;

    const amountCents = toCents(invoice.total.toString());
    if (amountCents <= 0n) return;

    await recordEntry({
        clientId: invoice.clientId,
        entityId,
        movementType: "CHARGE",
        amountCents,
        createdById: invoice.createdBy,
        reference,
        description: `Cargo automático por factura ${invoice.invoiceNumber ?? invoice.id} (crédito)`,
        metadata: {
            source: "invoice_credit_hook",
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber ?? null,
        },
    });
}

/**
 * Sync de Supplier → MotorEntity (kind=COMPANY siempre).
 * Llamar después de crear o actualizar un Supplier para que aparezca
 * en el Motor como entidad financiera.
 */
export async function syncSupplierToMotorEntity(supplierId: string): Promise<void> {
    try {
        const supplier = await prismaServer.supplier.findUnique({
            where: { id: supplierId },
            select: {
                clientId: true,
                name: true,
                ruc: true,
                email: true,
                phone: true,
            },
        });
        if (!supplier) return;

        const docNumber = supplier.ruc?.trim() || null;
        const email = supplier.email?.trim().toLowerCase() || null;

        // Buscar match existente
        let existing: MotorEntity | null = null;
        if (docNumber) {
            existing = await prismaServer.motorEntity.findFirst({
                where: {
                    clientId: supplier.clientId,
                    documentNumber: docNumber,
                    deletedAt: null,
                },
            });
        }
        if (!existing && email) {
            existing = await prismaServer.motorEntity.findFirst({
                where: {
                    clientId: supplier.clientId,
                    primaryEmail: email,
                    deletedAt: null,
                },
            });
        }

        if (existing) {
            const patch: Record<string, string> = {};
            if (!existing.primaryEmail && email) patch.primaryEmail = email;
            if (!existing.primaryPhone && supplier.phone) patch.primaryPhone = supplier.phone;
            if (!existing.documentNumber && docNumber) {
                patch.documentNumber = docNumber;
                patch.documentType = "RUC";
            }
            if (Object.keys(patch).length > 0) {
                await prismaServer.motorEntity.update({
                    where: { id: existing.id },
                    data: patch,
                });
            }
            return;
        }

        await prismaServer.motorEntity.create({
            data: {
                clientId: supplier.clientId,
                kind: "COMPANY",
                displayName: supplier.name,
                documentType: docNumber ? "RUC" : null,
                documentNumber: docNumber,
                primaryEmail: email,
                primaryPhone: supplier.phone ?? null,
                customFields: { source: "supplier", supplierId },
            },
        });
    } catch (err) {
        console.error("[MotorHook] Error sincronizando supplier:", err);
    }
}
