"use client";

import { Package, Edit3, Trash2, Loader2, Lock, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { deleteProductAction } from "@/actions/inventory-actions";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SecurityModal } from "./SecurityModal";
import { ProductLabelModal } from "./ProductLabelModal";
import { ProductImage } from "@/components/ui/product-image";

interface Product {
    id: string;
    sku: string | null;
    barcode: string | null;
    name: string;
    brand: string | null;
    currentStock: any; // Decimal handle
    salePrice: any;
    unitType: string;
    image: string | null;
}

interface ProductListProps {
    products: Product[];
    /**
     * Controlled lock state. When true (default), edit/delete actions in
     * the table are disabled. The toggle UI lives in the parent
     * (RecentProductsSection) so the lock button can be placed inline
     * with the section header instead of taking its own row.
     */
    isLocked?: boolean;
}

export function ProductList({ products, isLocked = true }: ProductListProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [showSecurity, setShowSecurity] = useState<{ id: string, name: string } | null>(null);
    const [showLabel, setShowLabel] = useState<Product | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleDelete = async (password: string) => {
        if (!showSecurity) return;

        const { id } = showSecurity;
        setIsDeleting(id);

        const result = await deleteProductAction(id, password);

        if (result.success) {
            setShowSecurity(null);
            router.refresh();
        } else {
            alert(result.error || "Error al eliminar el producto");
        }
        setIsDeleting(null);
    };

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead>
                            <tr>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-gray-50 dark:border-slate-800/50 bg-gray-50/50 dark:bg-slate-900/30">
                                    Producto
                                </th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] text-center border-b border-gray-50 dark:border-slate-800/50 bg-gray-50/50 dark:bg-slate-900/30">
                                    SKU / Código
                                </th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] text-center border-b border-gray-50 dark:border-slate-800/50 bg-gray-50/50 dark:bg-slate-900/30">
                                    Stock
                                </th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] text-right border-b border-gray-50 dark:border-slate-800/50 bg-gray-50/50 dark:bg-slate-900/30">
                                    Precio
                                </th>
                                <th className="px-6 py-5 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em] text-right border-b border-gray-50 dark:border-slate-800/50 bg-gray-50/50 dark:bg-slate-900/30">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800/50">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-gray-400 dark:text-slate-600">
                                        <Package className="h-16 w-16 mx-auto mb-4 opacity-10" />
                                        <span className="text-xs font-black uppercase tracking-widest">No hay productos registrados</span>
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr
                                        key={product.id}
                                        className="hover:bg-gray-50/50 dark:hover:bg-slate-800/20 transition-all duration-300 group"
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-gray-200/50 dark:border-slate-700/50 shadow-sm flex-shrink-0">
                                                    {product.image ? (
                                                        <ProductImage
                                                            width={48}
                                                            height={48}
                                                            src={product.image}
                                                            alt={product.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <Package className="h-5 w-5 text-gray-300 dark:text-slate-600" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-bold text-gray-900 dark:text-white tracking-tight">
                                                        {product.name}
                                                    </span>
                                                    <span className="text-[10px] font-black text-violet-600/50 dark:text-violet-400/40 uppercase tracking-widest">
                                                        {product.brand || "Sin marca"}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-mono font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 uppercase tracking-tight border border-gray-200/50 dark:border-slate-700/50">
                                                {product.sku || product.barcode || "-"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={cn(
                                                    "text-sm font-black tabular-nums",
                                                    Number(product.currentStock) <= 0 ? "text-rose-500" : "text-gray-900 dark:text-white"
                                                )}>
                                                    {mounted ? Number(product.currentStock).toLocaleString() : "---"}
                                                </span>
                                                <span className="text-[9px] font-black text-gray-400 dark:text-slate-600 uppercase tracking-widest">
                                                    {product.unitType}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-sm text-gray-900 dark:text-white tabular-nums">
                                            {mounted ? `$${Number(product.salePrice).toLocaleString()}` : "---"}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-1 row-acts">
                                                <button
                                                    onClick={() => setShowLabel(product)}
                                                    className="p-2.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/10 rounded-xl transition-all"
                                                    title="Imprimir etiqueta QR"
                                                >
                                                    <QrCode size={16} />
                                                </button>
                                                {!isLocked ? (
                                                    <>
                                                        <Link
                                                            href={`/dashboard/inventory/productos/${product.id}`}
                                                            className="p-2.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/10 rounded-xl transition-all"
                                                        >
                                                            <Edit3 size={16} />
                                                        </Link>
                                                        <button
                                                            onClick={() => setShowSecurity({ id: product.id, name: product.name })}
                                                            disabled={isDeleting === product.id}
                                                            className="p-2.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-all disabled:opacity-50"
                                                        >
                                                            {isDeleting === product.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-gray-300 dark:text-slate-700 font-medium italic px-2">
                                                        Solo Lectura
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <SecurityModal
                    isOpen={!!showSecurity}
                    onClose={() => setShowSecurity(null)}
                    onConfirm={handleDelete}
                    title="Eliminar Producto"
                    description={`Se eliminará permanentemente "${showSecurity?.name}". Esta acción requiere su contraseña.`}
                    actionLabel="Confirmar Eliminación"
                    isLoading={!!isDeleting}
                />

                {showLabel && (
                    <ProductLabelModal
                        isOpen
                        onClose={() => setShowLabel(null)}
                        product={{
                            ...showLabel,
                            salePrice: Number(showLabel.salePrice),
                        }}
                    />
                )}
            </div>
        </div>
    );
}
