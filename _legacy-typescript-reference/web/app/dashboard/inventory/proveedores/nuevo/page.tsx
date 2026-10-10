import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import NuevoProveedorForm from "./nuevo-proveedor-form";

export default async function NuevoProveedorPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { client: true }
    });

    if (!user?.client || (!user.client.inventoryEnabled && session.user?.role !== "SUPER_ADMIN")) {
        redirect("/dashboard/inventory");
    }

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="space-y-1">
                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
                        Nuevo Proveedor
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Registra un nuevo proveedor en el sistema
                    </p>
                </div>

                {/* Form */}
                <NuevoProveedorForm />
            </div>
        </div>
    );
}
