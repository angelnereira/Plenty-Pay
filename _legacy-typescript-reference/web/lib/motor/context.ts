/**
 * Contexto de tenant para el Módulo de Créditos / Motor de Clientes.
 *
 * v2.1 (tiered pricing):
 *   - El "Motor de Clientes" (antes "Motor de Entidades") sigue corriendo
 *     por debajo, omnipresente para todos los tenants — sincroniza
 *     entidades desde facturación/POS/proveedores y mantiene el ledger.
 *   - El "Módulo de Créditos" es la UI visible. Se gatea por la
 *     combinación Client.creditosEnabled = true Y motorCreditTier != null
 *     (default: módulo apagado, sin tier).
 *
 * Distinguimos dos contextos:
 *
 *   - getMotorPanelContext()  → Server Actions del panel de Créditos
 *     (CRUD entidades, ajustes manuales del ledger, lealtad,
 *     comprobantes, schema builder, intereses por ciclo). Requiere
 *     creditosEnabled = true Y motorCreditTier asignado.
 *
 *   - getMotorTenantContext() → flujos IMPLÍCITOS que operan para
 *     todos los usuarios del tenant (autocompletado de entidades,
 *     búsqueda, hooks de sync desde facturación/POS/suppliers). Solo
 *     requiere sesión válida con tenant. NO depende del flag ni del tier.
 *
 * Diferencia con requireCreditAccess (de core/motor/access.ts):
 *   - requireCreditAccess: para layouts / Server Components → notFound()
 *   - getMotorPanelContext: para Server Actions del panel → throw Error
 */

import type { Session } from "next-auth";
import { auth } from "@core/auth";
import { prismaServer } from "@core/database/prisma-server";

export interface MotorContext {
    session: Session;
    clientId: string;
    userId: string;
}

/**
 * Contexto base — sólo requiere sesión + tenant. Sin gate de módulo
 * ni de tier. Usar para: searchEntities, hooks implícitos
 * (processInvoiceForMotor, syncSupplierToMotorEntity), queries de
 * autocompletado. El motor de clientes corre para todos los tenants
 * sin importar creditosEnabled / motorCreditTier.
 */
export async function getMotorTenantContext(): Promise<MotorContext> {
    const session = (await auth()) as Session | null;
    if (!session?.user?.id || !session.user.clientId) {
        throw new Error("No autorizado");
    }
    return {
        session,
        clientId: session.user.clientId,
        userId: session.user.id,
    };
}

/**
 * Contexto del panel del Módulo de Créditos. Requiere:
 *   - sesión válida con tenant
 *   - usuario no SUPER_ADMIN
 *   - tenant con creditosEnabled = true
 *   - tenant con motorCreditTier asignado (TIER_1/2/3)
 *
 * Usar para: createEntity, updateEntity, registerCharge, registerPayment,
 * registerAdjustment, schema builder, lealtad, intereses.
 */
export async function getMotorPanelContext(): Promise<MotorContext> {
    const ctx = await getMotorTenantContext();
    if (ctx.session.user.role === "SUPER_ADMIN") {
        throw new Error("SUPER_ADMIN no opera el Módulo de Créditos directamente");
    }
    const client = await prismaServer.client.findUnique({
        where: { id: ctx.clientId },
        select: { creditosEnabled: true, motorCreditTier: true },
    });
    if (!client || !client.creditosEnabled || !client.motorCreditTier) {
        throw new Error("El Módulo de Créditos no está activo para este tenant");
    }
    return ctx;
}

/**
 * @deprecated v1.1 — el motor de clientes corre para todos. Conservada
 * por compatibilidad con código que la importe; siempre devuelve true.
 */
export async function isMotorActiveForClient(_clientId: string): Promise<boolean> {
    return true;
}
