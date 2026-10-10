/**
 * Gate de acceso al Módulo BI para layouts y Server Components.
 *
 * Llama notFound() si:
 *   - No hay sesión
 *   - El usuario no pertenece a un tenant
 *   - El usuario es SUPER_ADMIN (BI del cliente — SUPER_ADMIN tiene su
 *     propio panel en /dashboard/admin/analytics)
 *   - El tenant tiene biEnabled = false (y biProEnabled = false)
 */

import type { Session } from "next-auth";
import { auth } from "@core/auth";
import { prismaServer } from "@core/database/prisma-server";
import { notFound } from "next/navigation";
import { isBIEnabled, isBIProEnabled } from "@/lib/constants/plans";

export interface BIAccess {
    session: Session;
    clientId: string;
    userId: string;
    pro: boolean;
}

export async function requireBIAccess(): Promise<BIAccess> {
    const session = (await auth()) as Session | null;
    if (!session?.user?.id || !session.user.clientId) {
        notFound();
    }
    if (session.user.role === "SUPER_ADMIN") {
        notFound();
    }
    // Try/catch defensivo: si la BD tiembla, preferimos un 404 limpio
    // antes de propagar al error boundary global del dashboard.
    let client: { biEnabled: boolean; biProEnabled: boolean } | null = null;
    try {
        client = await prismaServer.client.findUnique({
            where: { id: session.user.clientId },
            select: { biEnabled: true, biProEnabled: true },
        });
    } catch (err) {
        console.error("[requireBIAccess] DB error", err);
        notFound();
    }
    if (!client || !isBIEnabled(client)) {
        notFound();
    }
    return {
        session,
        clientId: session.user.clientId,
        userId: session.user.id,
        pro: isBIProEnabled(client),
    };
}

/**
 * Variante para rutas Pro (forecast, builder, segmentos, campañas).
 * Llama notFound() si BI Pro no está activo.
 */
export async function requireBIProAccess(): Promise<BIAccess> {
    const access = await requireBIAccess();
    if (!access.pro) notFound();
    return access;
}
