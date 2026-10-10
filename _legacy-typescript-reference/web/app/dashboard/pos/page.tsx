import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PosPageClient } from "@/features/pos/ui/PosPageClient";
import { PosProduct } from "@/features/pos/stores/pos.store";
import { Store } from "lucide-react";
import Link from "next/link";

export default async function PosPage() {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
        redirect("/");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { client: true }
    });

    if (!user || !user.clientId) {
        redirect("/");
    }

    // Module access check - only allow if posEnabled or user is SUPER_ADMIN
    if (!user.client?.posEnabled && session.user?.role !== "SUPER_ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-full mb-6">
                    <Store className="h-12 w-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Módulo no disponible
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
                    El Punto de Venta no está habilitado para su plan actual.
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

    // Fetch products for POS
    // Optimization: filtering only active products and selecting necessary fields
    const productsSource = await prisma.product.findMany({
        where: {
            clientId: user.clientId,
            isActive: true,
            deletedAt: null
        },
        orderBy: {
            name: 'asc'
        }
    });

    const products: PosProduct[] = productsSource.map(p => ({
        id: p.id,
        name: p.name,
        price: Number(p.salePrice),
        sku: p.sku || undefined,
        barcode: p.barcode || undefined,
        stock: Number(p.currentStock),
        taxRate: Number(p.taxRate),
        image: p.image || undefined,
        category: p.category || undefined
    }));

    return (
        <div className="h-full bg-gray-50 dark:bg-transparent">
            <PosPageClient
                products={products}
                userName={user.name || "Usuario"}
                clientId={user.clientId}
                checkoutPreference={user.checkoutPreference as any}
                checkoutThreshold={Number(user.checkoutThreshold)}
            />
        </div>
    );
}
