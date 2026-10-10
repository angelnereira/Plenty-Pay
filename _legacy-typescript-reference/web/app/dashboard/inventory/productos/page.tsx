import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductList } from "@/features/inventory/ui/components/ProductList";
import { ScanProductButton } from "@/features/inventory/ui/components/ScanProductButton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { jsonify } from "@/lib/serialize";

export default async function ProductsPage() {
    const session = await auth();
    if (!session) redirect("/");

    const user = await prisma.user.findUnique({
        where: { id: session.user?.id },
        select: { clientId: true }
    });

    if (!user?.clientId) redirect("/dashboard");

    let products;
    try {
        products = await prisma.product.findMany({
            where: { clientId: user.clientId, deletedAt: null },
            orderBy: { name: 'asc' }
        });
    } catch (error) {
        console.error("[PRODUCTS_PAGE_FETCH_ERROR]", error);
        throw error;
    }

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Catálogo de Productos
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Administre sus productos, precios y niveles de stock.
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <ScanProductButton />
                        <Link
                            href="/dashboard/inventory/productos/nuevo"
                            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-violet-500/20"
                        >
                            <Plus size={18} />
                            <span>Nuevo Producto</span>
                        </Link>
                    </div>
                </div>

                <ProductList products={jsonify(products)} />
            </div>
        </div>
    );
}
