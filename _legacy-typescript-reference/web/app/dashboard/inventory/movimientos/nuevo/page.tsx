import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { StockMovementForm } from "@/features/inventory/ui/components/StockMovementForm";
import { RefreshCw } from "lucide-react";

export default async function NewMovementPage() {
    const session = await auth();
    if (!session) redirect("/");

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                            <RefreshCw className="h-8 w-8 text-violet-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
                                Movimientos Directos
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Registre devoluciones, mermas o ajustes manuales de stock.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    <StockMovementForm />
                </div>
            </div>
        </div>
    );
}
