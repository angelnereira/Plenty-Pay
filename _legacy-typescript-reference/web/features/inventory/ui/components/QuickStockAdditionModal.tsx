"use client";

import { useState, useEffect } from "react";
import { searchProductsAction, getProductByIdAction, processStockMovementAction } from "@/actions/inventory-actions";
import { SecurityModal } from "./SecurityModal";
import {
    Search,
    Loader2,
    Package,
    PackagePlus,
    X,
    ArrowRight,
    AlertTriangle,
    Check
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickStockAdditionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function QuickStockAdditionModal({ isOpen, onClose, onSuccess }: QuickStockAdditionModalProps) {
    const [step, setStep] = useState<"search" | "quantity" | "confirm">("search");
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [query, setQuery] = useState("");
    const [foundProducts, setFoundProducts] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [productDetails, setProductDetails] = useState<any | null>(null);

    const [quantity, setQuantity] = useState("");
    const [reference, setReference] = useState("");
    const [showSecurity, setShowSecurity] = useState(false);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setStep("search");
            setQuery("");
            setFoundProducts([]);
            setSelectedProduct(null);
            setProductDetails(null);
            setQuantity("");
            setReference("");
            setError(null);
        }
    }, [isOpen]);

    // Search products
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length > 2) {
                setSearching(true);
                const result = await searchProductsAction(query);
                if (result.success) setFoundProducts(result.data || []);
                setSearching(false);
            } else {
                setFoundProducts([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const handleProductSelect = async (product: any) => {
        setSelectedProduct(product);
        setError(null);
        setQuery("");
        setFoundProducts([]);

        // Fetch full details
        const result = await getProductByIdAction(product.id);
        if (result.success) {
            setProductDetails(result.data);
        }
        setStep("quantity");
    };

    const handleQuantitySubmit = () => {
        const qty = Number(quantity);
        if (!qty || qty <= 0) {
            setError("Ingrese una cantidad válida mayor a cero");
            return;
        }
        setError(null);
        setShowSecurity(true);
    };

    const handleConfirm = async (password: string) => {
        if (!selectedProduct) return;

        setLoading(true);
        setError(null);

        const result = await processStockMovementAction({
            productId: selectedProduct.id,
            type: 'ENTRY',
            quantity: Number(quantity),
            reason: `Adición rápida de stock${reference ? `: ${reference}` : ''}`,
            reference: reference || undefined,
            password
        });

        if (result.success) {
            setShowSecurity(false);
            setStep("confirm");
            setTimeout(() => {
                onSuccess?.();
                onClose();
            }, 1500);
        } else {
            setError(result.error || "Error al procesar el movimiento");
            setLoading(false);
            setShowSecurity(false);
        }
    };

    const currentStock = productDetails?.currentStock ?? 0;
    const projectedStock = currentStock + (Number(quantity) || 0);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                                <PackagePlus size={20} className="text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    Ajuste Rápido
                                </h2>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                                    Adicionar stock a producto existente
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                        >
                            <X size={18} className="text-gray-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-4 rounded-2xl text-red-600 text-sm flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Step: Search */}
                        {step === "search" && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                                    Busque el producto al cual desea adicionar stock
                                </p>

                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        autoFocus
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        placeholder="Nombre o SKU del producto..."
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-base focus:ring-2 focus:ring-emerald-500 shadow-inner"
                                    />
                                    {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-emerald-600" />}

                                    {foundProducts.length > 0 && (
                                        <div className="absolute z-20 w-full mt-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto scrollbar-hide">
                                            {foundProducts.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => handleProductSelect(p)}
                                                    className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-4 border-b last:border-0 border-gray-50 dark:border-slate-800"
                                                >
                                                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600">
                                                        <Package size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-gray-900 dark:text-white uppercase text-sm truncate">{p.name}</p>
                                                        <p className="text-[10px] font-mono text-gray-400">SKU: {p.sku || "N/A"}</p>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                        {p.currentStock} {p.unitType}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step: Quantity */}
                        {step === "quantity" && selectedProduct && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                {/* Selected product card */}
                                <div className="flex items-center justify-between p-4 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                                    <div className="flex items-center gap-3">
                                        <Package size={24} className="opacity-80" />
                                        <div>
                                            <p className="font-black uppercase tracking-tight leading-tight">{selectedProduct.name}</p>
                                            <p className="text-[10px] font-mono opacity-80">SKU: {selectedProduct.sku || "N/A"}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedProduct(null); setProductDetails(null); setStep("search"); }}
                                        className="text-[9px] font-black uppercase tracking-widest bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors"
                                    >
                                        Cambiar
                                    </button>
                                </div>

                                {/* Stock projection */}
                                <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-5">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Proyección de Stock</p>
                                    <div className="flex items-center justify-center gap-4 text-2xl font-black">
                                        <span className="text-gray-400">{currentStock}</span>
                                        <ArrowRight size={20} className="text-emerald-500" />
                                        <span className={cn(
                                            "transition-colors",
                                            Number(quantity) > 0 ? "text-emerald-600" : "text-gray-300 dark:text-gray-600"
                                        )}>
                                            {projectedStock}
                                        </span>
                                        <span className="text-xs font-bold text-gray-400 uppercase">{productDetails?.unitType || 'UND'}</span>
                                    </div>
                                    {Number(quantity) > 0 && (
                                        <p className="text-center text-xs text-emerald-600 mt-2">
                                            +{quantity} unidades
                                        </p>
                                    )}
                                </div>

                                {/* Quantity input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                        Cantidad a Adicionar
                                    </label>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-5 text-3xl font-black focus:ring-2 focus:ring-emerald-500 shadow-inner text-center"
                                        placeholder="0"
                                        autoFocus
                                        min="1"
                                    />
                                </div>

                                {/* Reference (optional) */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                                        Referencia / Observación <span className="text-gray-300 dark:text-gray-600">(Opcional)</span>
                                    </label>
                                    <input
                                        value={reference}
                                        onChange={e => setReference(e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 shadow-inner"
                                        placeholder="Ej: Compra local, Reposición..."
                                    />
                                </div>

                                {/* Submit button */}
                                <button
                                    onClick={handleQuantitySubmit}
                                    disabled={!quantity || Number(quantity) <= 0}
                                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                >
                                    <PackagePlus size={18} />
                                    Confirmar Adición
                                </button>
                            </div>
                        )}

                        {/* Step: Confirm (Success) */}
                        {step === "confirm" && (
                            <div className="text-center py-8 animate-in fade-in zoom-in-95">
                                <div className="mx-auto w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-4">
                                    <Check size={32} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                                    ¡Stock Actualizado!
                                </h3>
                                <p className="text-sm text-gray-500 mt-2">
                                    Se adicionaron {quantity} unidades a {selectedProduct?.name}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <SecurityModal
                isOpen={showSecurity}
                onClose={() => setShowSecurity(false)}
                onConfirm={handleConfirm}
                title="Autorizar Ajuste de Stock"
                description="Por seguridad, ingrese su contraseña para confirmar la adición de stock."
                isLoading={loading}
            />
        </>
    );
}
