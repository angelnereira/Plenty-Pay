import { auth } from "@core/auth"
import { redirect } from "next/navigation"
import { HkaConfigForm } from "@/app/dashboard/settings/hka-config-form"
import { MobileHkaConfigForm } from "@/components/settings/mobile/mobile-hka-config-form"
import { InvoiceNumberingConfig } from "@/components/settings/invoice-numbering-config"
import { BillingModeSelector } from "@/components/settings/billing-mode-selector"
import { ModuleExportCard } from "@/components/dataport/module-export-card"
import { prismaServer } from "@core/database"
import { BillingCardMode } from "@/actions/user-preferences"

export default async function BillingConfigPage() {
    const session = await auth()

    if (!session || !session.user || !session.user.id) {
        redirect("/")
    }

    const userName = session.user.name || "Usuario"

    const user = await prismaServer.user.findUnique({
        where: { id: session.user.id },
        select: {
            name: true,
            id: true,
            metadata: true
        } as any
    }) as any;

    const metadata = (user?.metadata as Record<string, any>) || {};
    const currentMode = (metadata.billingCardMode as BillingCardMode) || 'DEFAULT';

    return (
        <>
            {/* Mobile Layout */}
            <div className="md:hidden">
                <MobileHkaConfigForm userName={userName} />
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:block space-y-6 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Configuración de Facturación</h1>
                    <p className="text-muted-foreground">
                        Gestiona tus credenciales de HKA y la configuración de emisión de documentos fiscales.
                    </p>
                </div>

                {/* Invoice Numbering Configuration */}
                <InvoiceNumberingConfig variant="desktop" />

                <HkaConfigForm />

                <div className="pt-6 border-t">
                    <h2 className="text-xl font-bold tracking-tight mb-4">Visualización</h2>
                    <BillingModeSelector currentMode={currentMode} />
                </div>

                <ModuleExportCard module="invoicing" />
            </div>
        </>
    )
}
