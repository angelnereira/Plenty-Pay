import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { RecentProductsSection } from "@/features/inventory/ui/components/RecentProductsSection";
import { Package, RefreshCw, Users, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { InventoryHeaderClient } from "@/features/inventory/ui/components/InventoryHeaderClient";
import { jsonify } from "@/lib/serialize";

export default async function InventoryPage() {
    const session = await auth();

    if (!session) {
        redirect("/");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user?.id },
        include: { client: true }
    });

    // Redirect if user doesn't have client or if inventory module is not enabled
    if (!user?.client) {
        redirect("/dashboard");
    }

    // Module access check - only allow if inventoryEnabled or user is SUPER_ADMIN
    if (!user.client.inventoryEnabled && session.user?.role !== "SUPER_ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-full mb-6">
                    <Package className="h-12 w-12 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Módulo no disponible
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
                    El módulo de control de inventario no está habilitado para su plan actual.
                    Contacte con soporte para activarlo.
                </p>
                <Link
                    href="/dashboard"
                    className="text-violet-600 hover:text-violet-700 font-medium"
                >
                    Volver al Inicio
                </Link>
            </div>
        );
    }

    let products;
    try {
        const clientId = user.client.id;

        products = await prisma.product.findMany({
            where: { clientId, deletedAt: null },
            orderBy: { updatedAt: 'desc' },
            take: 10
        });
    } catch (error: any) {
        console.error("[INVENTORY_PAGE_FETCH_ERROR]", error);
        throw error; // Re-throw to trigger error.tsx
    }

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent pb-12">
            <div className="max-w-7xl mx-auto space-y-8 px-4 pt-4 md:px-8 md:pt-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase whitespace-nowrap">
                            Control de Inventario
                        </h1>
                    </div>

                    <InventoryHeaderClient />
                </div>

                {/* Quick Access Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link href="/dashboard/inventory/productos" className="premium-card p-4 hover:border-violet-500/50 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg group-hover:scale-110 transition-transform">
                                <Package className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">Productos</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Catálogo completo</p>
                            </div>
                        </div>
                    </Link>
                    <Link href="/dashboard/inventory/proveedores" className="premium-card p-4 hover:border-blue-500/50 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
                                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">Proveedores</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Gestión y evaluación</p>
                            </div>
                        </div>
                    </Link>
                    <Link href="/dashboard/inventory/ordenes-compra" className="premium-card p-4 hover:border-emerald-500/50 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg group-hover:scale-110 transition-transform">
                                <ShoppingCart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">Compras</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Órdenes activas</p>
                            </div>
                        </div>
                    </Link>
                    <Link href="/dashboard/inventory/movimientos" className="premium-card p-4 hover:border-amber-500/50 transition-all group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg group-hover:scale-110 transition-transform">
                                <RefreshCw className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">Movimientos</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Entradas y salidas</p>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Section: Recent Products */}
                <RecentProductsSection products={jsonify(products)} />
            </div>
        </div>
    );
}
