import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { BatchEntryForm } from "@/features/inventory/ui/components/BatchEntryForm";

export default async function BatchEntryPage() {
    const session = await auth();
    if (!session) redirect("/");

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                        Ingreso por Lote
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Registre la entrada de productos, ajuste precios y gestione la fecha de vencimiento.
                    </p>
                </div>

                <BatchEntryForm />
            </div>
        </div>
    );
}
