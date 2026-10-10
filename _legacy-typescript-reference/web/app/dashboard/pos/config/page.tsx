import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { PosSettingsForm } from "@/features/config/ui/PosSettingsForm";
import { ModuleExportCard } from "@/components/dataport/module-export-card";

export default async function PosConfigPage() {
    const session = await auth();

    if (!session) {
        redirect("/");
    }

    return (
        <div className="space-y-6 w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    Configuración de Punto de Venta
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Gestiona cajas, impresoras y métodos de pago.
                </p>
            </div>

            <PosSettingsForm />

            <ModuleExportCard module="pos" />
        </div>
    );
}
