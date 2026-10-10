import { auth } from "@core/auth";
import { redirect, notFound } from "next/navigation";
import { getProductByIdAction } from "@/actions/inventory-actions";
import { ProductForm } from "@/features/inventory/ui/components/ProductForm";
import { ProductHistory } from "@/features/inventory/ui/components/ProductHistory";
import { ProductLabelButton } from "./ProductLabelButton";
import Link from "next/link";
import { Info, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function ProductDetailPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ tab?: string }>
}) {
    const session = await auth();
    if (!session) redirect("/");

    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;

    let result;
    try {
        result = await getProductByIdAction(resolvedParams.id);
    } catch (error) {
        console.error("[PRODUCT_DETAIL_PAGE_FETCH_ERROR]", error);
        throw error;
    }

    if (!result.success || !result.data) {
        notFound();
    }

    const product = result.data;
    const activeTab = resolvedSearchParams.tab || "info";

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header Navigation */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
                                {product.name}
                            </h1>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-0.5 rounded border border-violet-100 dark:border-violet-800">
                                    SKU: {product.sku || "N/A"}
                                </span>
                                <span className="text-xs font-bold text-gray-400 uppercase">
                                    {product.brand || "Sin Marca"}
                                </span>
                            </div>
                        </div>

                        <div className="hidden md:flex items-center gap-3">
                            <ProductLabelButton product={{
                                id: product.id,
                                name: product.name,
                                sku: product.sku,
                                barcode: product.barcode,
                                salePrice: Number(product.salePrice),
                                unitType: product.unitType,
                                brand: product.brand,
                            }} />
                            <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-4 rounded-3xl shadow-sm text-right">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Stock Disponible</p>
                                <p className="text-3xl font-black text-violet-600 dark:text-violet-400 leading-tight">
                                    {Number(product.currentStock)}
                                    <span className="text-sm ml-1 text-gray-400">{product.unitType}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-900/50 w-fit rounded-2xl border border-gray-200 dark:border-slate-800">
                    <Link
                        href={`?tab=info`}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                            activeTab === "info"
                                ? "bg-white dark:bg-slate-800 text-violet-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                    >
                        <Settings size={14} />
                        Configuración
                    </Link>
                    <Link
                        href={`?tab=history`}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                            activeTab === "history"
                                ? "bg-white dark:bg-slate-800 text-violet-600 shadow-sm"
                                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        )}
                    >
                        <History size={14} />
                        Historial de Movimientos
                    </Link>
                </div>

                {/* Content */}
                <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {activeTab === "info" ? (
                        <div className="space-y-6">
                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 p-4 rounded-2xl flex items-start gap-3">
                                <Info className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Edición de Información</p>
                                    <p className="text-xs text-amber-700 dark:text-amber-500/80">Los cambios realizados aquí se reflejarán inmediatamente en el catálogo y facturación.</p>
                                </div>
                            </div>
                            <ProductForm initialData={product} id={resolvedParams.id} />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                                    <History className="h-5 w-5 text-violet-600" />
                                    Últimos 50 Movimientos
                                </h2>
                                <Link
                                    href="/dashboard/inventory/movimientos/nuevo"
                                    className="text-[10px] font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl uppercase tracking-widest hover:opacity-90 transition-opacity"
                                >
                                    Nuevo Movimiento
                                </Link>
                            </div>
                            <ProductHistory transactions={product.transactions} unitType={product.unitType} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
