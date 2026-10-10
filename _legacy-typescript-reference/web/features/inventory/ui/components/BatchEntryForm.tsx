"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { processBatchEntryAction, searchProductsAction } from "@/actions/inventory-actions";
import { Loader2, Search, Calendar, Hash, Tag, DollarSign, Package, Check, ChevronRight, ChevronLeft, Info, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
    { id: 1, title: "Seleccionar Producto", icon: Search },
    { id: 2, title: "Detalles del Movimiento", icon: Hash },
    { id: 3, title: "Revisar y Confirmar", icon: Check },
];

const DOCUMENT_TYPES = [
    { value: "FACTURA", label: "Factura de Compra" },
    { value: "NOTA_ENTREGA", label: "Nota de Entrega / Conduce" },
    { value: "DEV_VENTA", label: "Devolución de Venta" },
    { value: "AJUSTE", label: "Ajuste de Inventario" },
    { value: "TRASLADO", label: "Traslado entre Depósitos" },
];

export function BatchEntryForm() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [query, setQuery] = useState("");
    const [foundProducts, setFoundProducts] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

    const [formData, setFormData] = useState({
        quantity: "",
        batchNumber: "",
        expiryDate: "",
        purchasePrice: "",
        salePrice: "",
        docType: "FACTURA",
        notes: "",
    });

    const [lastScanned, setLastScanned] = useState(false);

    // Search logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (query.length > 2) {
                setSearching(true);
                const result = await searchProductsAction(query);
                if (result.success) {
                    const data = result.data || [];
                    setFoundProducts(data);

                    // Si el usuario presionó Enter (lastScanned) y hay una coincidencia exacta o única
                    if (lastScanned && data.length === 1) {
                        setSelectedProduct(data[0]);
                        setLastScanned(false);
                        setQuery("");
                    }
                }
                setSearching(false);
            } else {
                setFoundProducts([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [query, lastScanned]);

    // Manejar Enter (Scanner)
    const handleKeyDown = (e: React.KeyboardEvent, fieldName: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();

            if (fieldName === 'query') {
                setLastScanned(true);
                // Si ya está seleccionado, avanzar
                if (selectedProduct) nextStep();
            } else if (fieldName === 'quantity') {
                if (formData.quantity) nextStep();
            }
        }
    };

    // Pre-fill prices when product is selected
    useEffect(() => {
        if (selectedProduct) {
            setFormData(prev => ({
                ...prev,
                purchasePrice: String(selectedProduct.purchasePrice || ""),
                salePrice: String(selectedProduct.salePrice || ""),
            }));
        }
    }, [selectedProduct]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const nextStep = () => {
        if (currentStep === 1 && !selectedProduct) {
            setError("Debe seleccionar un producto para continuar");
            return;
        }
        if (currentStep === 2) {
            if (!formData.quantity || Number(formData.quantity) <= 0) {
                setError("La cantidad debe ser mayor a cero");
                return;
            }
            if (!formData.purchasePrice || Number(formData.purchasePrice) < 0) {
                setError("El costo de compra no es válido");
                return;
            }
        }
        setError(null);
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    };

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedProduct) return;

        setLoading(true);
        setError(null);

        const data = {
            productId: selectedProduct.id,
            batchNumber: formData.batchNumber || undefined,
            quantity: Number(formData.quantity),
            purchasePrice: Number(formData.purchasePrice),
            salePrice: formData.salePrice ? Number(formData.salePrice) : undefined,
            expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined,
            notes: `${formData.docType}: ${formData.notes || 'Ingreso de mercancía'}`.trim(),
        };

        const result = await processBatchEntryAction(data);

        if (result.success) {
            router.push("/dashboard/inventory");
            setTimeout(() => router.refresh(), 100);
        } else {
            setError(result.error || "Ocurrió un error");
            setLoading(false);
        }
    }

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const today = !mounted ? "" : new Date().toLocaleDateString('es-PA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="max-w-4xl mx-auto">
            {/* Stepper Header */}
            <div className="mb-8 overflow-x-auto scrollbar-hide pb-4">
                <div className="flex items-center justify-between min-w-[600px] px-4">
                    {STEPS.map((step, idx) => {
                        const Icon = step.icon;
                        const isCompleted = currentStep > step.id;
                        const isActive = currentStep === step.id;

                        return (
                            <div key={step.id} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center relative gap-2">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 z-10",
                                        isCompleted ? "bg-green-500 border-green-500 text-white" :
                                            isActive ? "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-500/20 scale-110" :
                                                "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-400"
                                    )}>
                                        {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                    </div>
                                    <span className={cn(
                                        "text-xs font-semibold whitespace-nowrap transition-colors",
                                        isActive ? "text-violet-600 dark:text-violet-400" : "text-gray-500"
                                    )}>
                                        {step.title}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className={cn(
                                        "h-[2px] flex-1 mx-4 mb-6 transition-colors duration-300",
                                        isCompleted ? "bg-green-500" : "bg-gray-200 dark:bg-slate-800"
                                    )} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="p-8">
                    {error && (
                        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-red-600 text-sm flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Step 1: Search */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 font-mono">1. Localizar Producto</h3>
                                <p className="text-sm text-gray-500 mb-6">Busque el ítem en su catálogo para registrar la entrada de stock.</p>

                                {!selectedProduct ? (
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                        <input
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(e, 'query')}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-4 text-base focus:ring-2 focus:ring-violet-500 shadow-inner"
                                            placeholder="Nombre, SKU (Ej: PINT-01) o Código de Barras..."
                                            autoFocus
                                            autoComplete="off"
                                        />
                                        {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-violet-600" />}

                                        {foundProducts.length > 0 && (
                                            <div className="absolute z-20 w-full mt-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto scrollbar-hide">
                                                {foundProducts.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => {
                                                            setSelectedProduct(p);
                                                            setQuery("");
                                                            setFoundProducts([]);
                                                            setError(null);
                                                        }}
                                                        className="w-full text-left px-6 py-4 hover:bg-gray-50 dark:hover:bg-slate-800 flex items-center justify-between border-b last:border-0 border-gray-50 dark:border-slate-800 group"
                                                    >
                                                        <div>
                                                            <p className="font-bold text-gray-900 dark:text-white group-hover:text-violet-600 transition-colors uppercase">{p.name}</p>
                                                            <p className="text-xs text-gray-500 font-mono tracking-tighter">SKU: {p.sku || "N/A"} • Mca: {p.brand || "Generico"}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-black bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-3 py-1 rounded-full uppercase tracking-tighter">
                                                                Existencia: {Number(p.currentStock)} {p.unitType}
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between p-6 bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800 rounded-2xl shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-violet-600 rounded-xl text-white shadow-lg shadow-violet-500/20">
                                                <Package size={24} />
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-gray-900 dark:text-white uppercase">{selectedProduct.name}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-violet-600 font-mono font-bold tracking-widest bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-violet-100 dark:border-violet-800">{selectedProduct.sku || "SIN SKU"}</span>
                                                    <span className="text-xs text-gray-400 font-bold uppercase">{selectedProduct.brand}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedProduct(null)}
                                            className="text-xs font-black uppercase tracking-widest text-red-600 hover:text-red-700 p-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                                        >
                                            Cambiar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Details */}
                    {currentStep === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Quantities & Batch */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-tighter">Cantidad Recibida *</label>
                                        <div className="relative">
                                            <input
                                                name="quantity"
                                                type="number"
                                                required
                                                step="0.0001"
                                                value={formData.quantity}
                                                onChange={handleInputChange}
                                                onKeyDown={(e) => handleKeyDown(e, 'quantity')}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-2xl px-4 py-4 text-2xl font-black focus:ring-2 focus:ring-violet-500 shadow-inner"
                                                placeholder="0.00"
                                                autoFocus
                                                autoComplete="off"
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-violet-600 bg-violet-100 dark:bg-violet-900/40 px-3 py-1 rounded-full uppercase tracking-widest">
                                                {selectedProduct.unitType}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-tighter">Tipo de Documento</label>
                                        <div className="relative">
                                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                            <select
                                                name="docType"
                                                value={formData.docType}
                                                onChange={handleInputChange}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner appearance-none"
                                            >
                                                {DOCUMENT_TYPES.map(doc => (
                                                    <option key={doc.value} value={doc.value}>{doc.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-tighter">Número de Referencia / Lote</label>
                                        <div className="relative">
                                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input
                                                name="batchNumber"
                                                value={formData.batchNumber}
                                                onChange={handleInputChange}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner font-mono uppercase"
                                                placeholder="Ej: FAC-12345"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Pricing & Date */}
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-tighter">Costo de Compra Unitario *</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                            <input
                                                name="purchasePrice"
                                                type="number"
                                                step="0.01"
                                                required
                                                value={formData.purchasePrice}
                                                onChange={handleInputChange}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 font-mono font-bold shadow-inner"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Último costo: ${Number(selectedProduct.purchasePrice).toFixed(2)}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-tighter">Actualizar Precio de Venta</label>
                                        <div className="relative">
                                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                            <input
                                                name="salePrice"
                                                type="number"
                                                step="0.01"
                                                value={formData.salePrice}
                                                onChange={handleInputChange}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 font-mono font-bold shadow-inner"
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Precio actual: ${Number(selectedProduct.salePrice).toFixed(2)}</p>
                                    </div>

                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-2xl space-y-2">
                                        <label className="text-xs font-black text-amber-700 dark:text-amber-500 flex items-center gap-2 uppercase tracking-widest">
                                            <Calendar className="h-4 w-4" /> Vencimiento de Lote
                                        </label>
                                        <input
                                            name="expiryDate"
                                            type="date"
                                            value={formData.expiryDate}
                                            onChange={handleInputChange}
                                            className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-500 font-bold shadow-sm"
                                        />
                                        <p className="text-[9px] text-amber-600 font-black uppercase tracking-tight flex items-center gap-1">
                                            <Info size={10} /> Opcional: Solo para productos perecederos
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review */}
                    {currentStep === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-3xl p-8 border border-gray-100 dark:border-slate-800 shadow-inner">
                                <h3 className="text-lg font-black text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-slate-700 pb-4 font-mono uppercase tracking-tighter flex items-center gap-2">
                                    <Check className="h-5 w-5 text-green-500" /> Resumen del Movimiento
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ítem</p>
                                        <p className="font-black text-gray-900 dark:text-white uppercase text-lg leading-tight">{selectedProduct.name}</p>
                                        <p className="text-xs text-violet-600 font-mono font-bold tracking-widest uppercase bg-violet-50 dark:bg-violet-900/20 inline-block px-2 py-0.5 rounded">SKU: {selectedProduct.sku || "N/A"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Proyección de Existencias</p>
                                        <div className="flex items-center gap-3">
                                            <div className="text-center">
                                                <p className="text-[9px] font-bold text-gray-400 uppercase">Actual</p>
                                                <p className="font-bold text-gray-700 dark:text-gray-300">{Number(selectedProduct.currentStock)}</p>
                                            </div>
                                            <div className="text-violet-400 font-bold">+</div>
                                            <div className="text-center">
                                                <p className="text-[9px] font-bold text-gray-400 uppercase">Entrada</p>
                                                <p className="font-bold text-violet-600">{formData.quantity}</p>
                                            </div>
                                            <div className="text-gray-400 font-bold">=</div>
                                            <div className="bg-violet-600 text-white px-3 py-1 rounded-lg text-center shadow-lg shadow-violet-500/20">
                                                <p className="text-[9px] font-black uppercase opacity-80">Nuevo Saldo</p>
                                                <p className="font-black text-lg leading-none">{(Number(selectedProduct.currentStock) + Number(formData.quantity))}</p>
                                            </div>
                                            <span className="text-xs font-bold text-gray-400">{selectedProduct.unitType}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Referencia / Soporte</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black bg-gray-200 dark:bg-slate-700 px-2 py-1 rounded">{formData.docType}</span>
                                            <p className="font-bold text-gray-900 dark:text-white font-mono">{formData.batchNumber || "NO ESPECIFICADO"}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha Estimada</p>
                                        <p className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                            <Calendar size={14} className="text-violet-500" />
                                            {today}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inversión Unitario (Costo)</p>
                                        <p className="font-mono text-gray-900 dark:text-white font-black text-xl">${Number(formData.purchasePrice).toFixed(2)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Costo Total de Entrada</p>
                                        <p className="font-mono text-violet-600 dark:text-violet-400 font-black text-3xl tracking-tighter">
                                            {mounted ? `$${(Number(formData.quantity) * Number(formData.purchasePrice)).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "---"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="mt-12 flex justify-between items-center gap-4 border-t border-gray-50 dark:border-slate-800 pt-8">
                        {currentStep > 1 ? (
                            <button
                                type="button"
                                onClick={prevStep}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-black text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all border border-gray-100 dark:border-slate-800 uppercase text-xs tracking-widest"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Atrás
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="px-6 py-3 rounded-xl font-black text-gray-500 hover:text-gray-700 transition-colors uppercase text-xs tracking-widest"
                            >
                                Cancelar
                            </button>
                        )}

                        {currentStep < STEPS.length ? (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-black hover:opacity-90 transition-all shadow-lg uppercase text-xs tracking-widest active:scale-95"
                            >
                                Continuar
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-10 py-3 rounded-xl font-black transition-all shadow-lg shadow-violet-500/25 flex items-center gap-2 uppercase text-xs tracking-widest active:scale-95"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Procesar Entrada
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
