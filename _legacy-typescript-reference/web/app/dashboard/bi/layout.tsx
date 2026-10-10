import { requireBIAccess } from "@/features/bi";
import { BITabs } from "@/features/bi/ui/bi-tabs";

export const dynamic = "force-dynamic";

/**
 * Layout del Módulo BI (Business Intelligence).
 *
 * requireBIAccess() llama notFound() si:
 *   - No hay sesión válida
 *   - Usuario es SUPER_ADMIN (su BI vive en /dashboard/admin/analytics)
 *   - El tenant tiene Client.biEnabled = false y biProEnabled = false
 *
 * Por defecto el módulo está apagado: el cliente debe activar el addon
 * `bi` ($25/mes) o `biPro` ($59/mes — incluye Esencial) desde
 * Mi Suscripción.
 */
export default async function BILayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await requireBIAccess();
    return (
        <div className="container mx-auto py-6 px-4 max-w-7xl">
            <BITabs />
            {children}
        </div>
    );
}
