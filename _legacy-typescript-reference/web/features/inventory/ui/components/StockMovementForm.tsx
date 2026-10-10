"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchProductsAction, processStockMovementAction, getProductByIdAction } from "@/actions/inventory-actions";
import { ProductHistory } from "./ProductHistory";
import {
    Search,
    Loader2,
    Package,
    ArrowUpCircle,
    ArrowDownCircle,
    Trash2,
    RefreshCcw,
    Check,
    AlertTriangle,
    FileText,
    ChevronRight,
    ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SecurityModal } from "./SecurityModal";

const MOVEMENT_TYPES = [
    {
        id: "CUSTOMER_RETURN",
        label: "Devolución de Cliente",
        icon: ArrowUpCircle,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        description: "El cliente devuelve mercancía vendida. El stock aumenta.",
        baseType: "ENTRY"
    },
    {
        id: "SUPPLIER_RETURN",
        label: "Devolución a Proveedor",
        icon: ArrowDownCircle,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        description: "Se devuelve mercancía defectuosa o sobrante al proveedor. El stock disminuye.",
        baseType: "EXIT"
    },
    {
        id: "SCRAP",
        label: "Descarte / Merma",
        icon: Trash2,
        color: "text-rose-500",
        bg: "bg-rose-500/10",
        description: "Productos dañados, vencidos o inutilizables. El stock disminuye.",
        baseType: "EXIT"
    },
    {
        id: "ADJUSTMENT",
        label: "Ajuste de Inventario",
        icon: RefreshCcw,
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        description: "Corrección manual de stock por conteo físico. Puede aumentar o disminuir.",
        baseType: "ADJUST"
    },
];

export function StockMovementForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialProductId = searchParams.get("productId");

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [query, setQuery] = useState("");
    const [foundProducts, setFoundProducts] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [productDetails, setProductDetails] = useState<any | null>(null);
    const [selectedType, setSelectedType] = useState<any>(null);
    const [showSecurity, setShowSecurity] = useState(false);

    const [formData, setFormData] = useState({
        quantity: "",
        reason: "",
        reference: "",
        adjustmentType: "EXIT" as "ENTRY" | "EXIT" // Only for manual adjustment
    });

    // Search logic
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const nextStep = () => {
        if (currentStep === 1 && !selectedProduct) {
            setError("Seleccione un producto");
            return;
        }
        if (currentStep === 2 && !selectedType) {
            setError("Seleccione un tipo de movimiento");
            return;
        }
        setError(null);
        setCurrentStep(prev => prev + 1);
    };

    const handleProductSelect = async (product: any) => {
        setSelectedProduct(product);
        setError(null); // Clear error immediately
        setQuery(""); // Clear search query for cleaner UI

        // Fetch full details including history
        const result = await getProductByIdAction(product.id);
        if (result.success) {
            setProductDetails(result.data);
        }

        // Auto advance is sometimes annoying if you want to see history first, 
        // limiting auto-advance to only if not already selected to allow re-selection
        // But user flow suggests we proceed. Let's keep it manual or auto? 
        // User complained about error message sticking, so explicitly clearing it is key.
        // Let's NOT auto-advance immediately so they can see the history as requested.
        // But the previous code did: onClick={() => { setSelectedProduct(p); nextStep(); }}
        // The user said "leaves that red message", implying they might have tried to go next or it appeared.
        // I will change the behavior to stay on step 1 briefly or show a "Continuar" button?
        // Actually, the original code had `nextStep()` in the onClick. I will remove `nextStep()` to let them see history first, 
        // OR simpler: just render history in Step 1 and let them click "Continued".
        // Let's modify the UI to show history IN Step 1 after selection.
    };

    const handleConfirm = async (password: string) => {
        if (!selectedProduct || !selectedType) return;

        setLoading(true);
        const finalType = selectedType.id === 'ADJUSTMENT' ? formData.adjustmentType : selectedType.baseType;
        const finalReason = `${selectedType.label}: ${formData.reason}`;

        const result = await processStockMovementAction({
            productId: selectedProduct.id,
            type: finalType as any,
            quantity: Number(formData.quantity),
            reason: finalReason,
            reference: formData.reference || undefined,
            password
        });

        if (result.success) {
            router.push(`/dashboard/inventory/productos/${selectedProduct.id}?tab=history`);
            setTimeout(() => router.refresh(), 100);
        } else {
            setError(result.error ?? null);
            setLoading(false);
            setShowSecurity(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* Steps Indicator */}
            <div className="flex items-center justify-center gap-4 mb-8">
                {[1, 2, 3].map(s => (
                    <div key={s} className={cn(
                        "w-3 h-3 rounded-full transition-all duration-300",
                        currentStep === s ? "bg-violet-600 w-8" :
                            currentStep > s ? "bg-emerald-500" : "bg-gray-200 dark:bg-slate-800"
                    )} />
                ))}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-gray-100 dark:border-slate-800 shadow-xl p-8">
                {error && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 p-4 rounded-2xl text-red-600 text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {error}
                    </div>
                )}

                {/* Step 1: Product Selection */}
                {currentStep === 1 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="space-y-2 text-center pb-4">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">1. Localizar Producto</h2>
                            <p className="text-sm text-gray-500">¿Sobre qué ítem desea realizar la acción?</p>
                        </div>

                        {!selectedProduct ? (
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    autoFocus
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Nombre o SKU..."
                                    className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-lg focus:ring-2 focus:ring-violet-500 shadow-inner"
                                />
                                {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-violet-600" />}

                                {foundProducts.length > 0 && (
                                    <div className="absolute z-20 w-full mt-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                                        {foundProducts.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => handleProductSelect(p)}
                                                className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center gap-4 border-b last:border-0 border-gray-50 dark:border-slate-800"
                                            >
                                                <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center text-violet-600">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white uppercase text-sm">{p.name}</p>
                                                    <p className="text-[10px] font-mono text-gray-400">SKU: {p.sku || "N/A"}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-6 bg-violet-600 rounded-3xl text-white shadow-xl shadow-violet-500/20">
                                    <div className="flex items-center gap-4">
                                        <Package size={32} className="opacity-80" />
                                        <div>
                                            <p className="text-lg font-black uppercase tracking-tight leading-tight">{selectedProduct.name}</p>
                                            <p className="text-xs font-mono opacity-80">SKU: {selectedProduct.sku || "N/A"}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedProduct(null);
                                            setProductDetails(null);
                                        }}
                                        className="text-[10px] font-black uppercase tracking-widest bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        Cambiar
                                    </button>
                                </div>

                                {/* Product History Preview */}
                                {productDetails && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                                        <div className="flex items-center justify-between px-2">
                                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Historial Reciente</h3>
                                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                                                Stock Actual: {productDetails.currentStock} {productDetails.unitType}
                                            </span>
                                        </div>
                                        <ProductHistory
                                            transactions={productDetails.transactions || []}
                                            unitType={productDetails.unitType}
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={nextStep}
                                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                                >
                                    Continuar
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )
                }

                {/* Step 2: Movement Type */}
                {
                    currentStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-2 text-center pb-4">
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">2. Tipo de Acción</h2>
                                <p className="text-sm text-gray-500">¿Qué tipo de movimiento desea registrar?</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {MOVEMENT_TYPES.map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => { setSelectedType(type); nextStep(); }}
                                        className={cn(
                                            "p-6 rounded-3xl border text-left transition-all duration-300 group",
                                            selectedType?.id === type.id
                                                ? "border-violet-600 bg-violet-50 dark:bg-violet-900/10 ring-1 ring-violet-600"
                                                : "border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 hover:border-violet-300 dark:hover:border-violet-800"
                                        )}
                                    >
                                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", type.bg)}>
                                            <type.icon size={24} className={type.color} />
                                        </div>
                                        <p className="font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-1">{type.label}</p>
                                        <p className="text-[10px] text-gray-500 leading-tight">{type.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )
                }

                {/* Step 3: Details */}
                {
                    currentStep === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-2 text-center pb-4">
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">3. Detalles Finales</h2>
                                <p className="text-sm text-gray-500">Complete los datos de la transacción.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Cantidad Afectada</label>
                                        <div className="relative">
                                            <input
                                                name="quantity"
                                                type="number"
                                                value={formData.quantity}
                                                onChange={handleInputChange}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-5 text-3xl font-black focus:ring-2 focus:ring-violet-500 shadow-inner"
                                                placeholder="0"
                                                autoFocus
                                            />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black bg-gray-200 dark:bg-slate-700 px-3 py-1.5 rounded-full uppercase">
                                                {selectedProduct.unitType}
                                            </span>
                                        </div>
                                    </div>

                                    {selectedType.id === 'ADJUSTMENT' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Efecto en Inventario</label>
                                            <div className="flex gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
                                                <button
                                                    onClick={() => setFormData(prev => ({ ...prev, adjustmentType: 'ENTRY' }))}
                                                    className={cn(
                                                        "flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                                        formData.adjustmentType === 'ENTRY' ? "bg-white dark:bg-slate-700 text-emerald-600 shadow-sm" : "text-gray-400"
                                                    )}
                                                >
                                                    Incrementar (+)
                                                </button>
                                                <button
                                                    onClick={() => setFormData(prev => ({ ...prev, adjustmentType: 'EXIT' }))}
                                                    className={cn(
                                                        "flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                                        formData.adjustmentType === 'EXIT' ? "bg-white dark:bg-slate-700 text-rose-600 shadow-sm" : "text-gray-400"
                                                    )}
                                                >
                                                    Disminuir (-)
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Referencia / No. Documento</label>
                                        <div className="relative">
                                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                            <input
                                                name="reference"
                                                value={formData.reference}
                                                onChange={handleInputChange}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl pl-12 pr-4 py-4 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner uppercase font-mono"
                                                placeholder="Ej: NC-567 o Ticket-01"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Observaciones / Motivo</label>
                                        <textarea
                                            name="reason"
                                            value={formData.reason}
                                            onChange={handleInputChange}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-4 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner h-24"
                                            placeholder="Ej: Producto llegó roto de fábrica..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowSecurity(true)}
                                disabled={!formData.quantity || !formData.reason}
                                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 rounded-[20px] font-black uppercase tracking-widest shadow-xl hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 group mt-8"
                            >
                                <Check className="group-hover:scale-125 transition-transform" />
                                Confirmar Movimiento
                            </button>
                        </div>
                    )
                }

                {/* Navigation */}
                {
                    currentStep > 1 && (
                        <div className="mt-8 pt-8 border-t border-gray-50 dark:border-slate-800 flex justify-between">
                            <button
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <ChevronLeft size={16} />
                                Paso Anterior
                            </button>
                        </div>
                    )
                }
            </div >

            <SecurityModal
                isOpen={showSecurity}
                onClose={() => setShowSecurity(false)}
                onConfirm={handleConfirm}
                title="Autorizar Movimiento Manual"
                description="Por seguridad, debe ingresar su contraseña para realizar ajustes manuales en el inventario."
                isLoading={loading}
            />
        </div >
    );
}
