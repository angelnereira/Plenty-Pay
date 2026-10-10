import { requireCreditAccess } from "@core/motor/access";

export const dynamic = "force-dynamic";

/**
 * Layout del Módulo de Créditos.
 *
 * requireCreditAccess() llama notFound() si:
 *   - No hay sesión válida
 *   - Usuario es SUPER_ADMIN
 *   - El tenant tiene Client.creditosEnabled = false
 *   - El tenant no tiene motorCreditTier asignado (sin tier de pricing)
 *
 * Por defecto el módulo está apagado: SUPER_ADMIN debe activarlo y elegir
 * un tier (TIER_1/2/3) en /dashboard/admin/clients/[clientId] → Módulos.
 * El motor de clientes por debajo (sync de entidades, ledger) sigue
 * corriendo para todos los tenants sin importar este flag.
 */
export default async function CreditosLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireCreditAccess();
    return <div className="container mx-auto py-6 px-4 max-w-6xl">{children}</div>;
}
