"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerProductAction, updateProductAction, checkDuplicateProductAction } from "@/actions/inventory-actions";
import { SerializedProduct } from "../../model/types/inventory.types";
import { Loader2, Package, Info, DollarSign, Globe, Check, ChevronRight, ChevronLeft, Image as ImageIcon, AlertTriangle, X, ScanLine, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SecurityModal } from "./SecurityModal";
import { ImageUpload } from "./ImageUpload";
import { ProductImage } from "@/components/ui/product-image";
import { BarcodeScannerModal } from "./BarcodeScannerModal";

const CPBS_UNITS = [
    { value: 'und', label: 'Unidad (und)' },
    { value: 'Mes', label: 'Mes (Mes)' },
    { value: 'Hora', label: 'Hora (Hora)' },
    { value: 'Día', label: 'Día (Día)' },
    { value: 'Actividad', label: 'Actividad' },
    { value: 'Viaje', label: 'Viaje' },
    { value: 'Persona', label: 'Persona' },
    { value: 'Paquete', label: 'Paquete' },
    { value: 'kg', label: 'Kilogramos (kg)' },
    { value: 'm', label: 'Metros (m)' },
    { value: 'm2', label: 'Metro Cuadrado (m²)' },
];

const STEPS = [
    { id: 1, title: "Información General", icon: Info },
    { id: 2, title: "Características", icon: Package },
    { id: 3, title: "Precios e Impuestos", icon: DollarSign },
];

const PANAMA_UNITS = [
    { value: "UND", label: "Unidad (UND)" },
    { value: "CAJA", label: "Caja" },
    { value: "BTO", label: "Bulto" },
    { value: "PAQ", label: "Paquete" },
    { value: "DOC", label: "Docena" },
    { value: "GL", label: "Galón (GL)" },
    { value: "LT", label: "Litro (LT)" },
    { value: "KG", label: "Kilogramo (KG)" },
    { value: "LB", label: "Libra (LB)" },
    { value: "MT", label: "Metro (MT)" },
    { value: "PLG", label: "Pulgada (IN)" },
];

export function ProductForm({ initialData, id }: { initialData?: Partial<SerializedProduct>, id?: string }) {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

    const [formData, setFormData] = useState({
        name: initialData?.name || "",
        brand: initialData?.brand || "",
        sku: initialData?.sku || "",
        barcode: initialData?.barcode || "",
        unitType: initialData?.unitType || "UND",
        weight: initialData?.weight || "",
        size: initialData?.size || "",
        color: initialData?.color || "",
        category: initialData?.category || "",
        description: initialData?.description || "",
        purchasePrice: initialData?.purchasePrice !== undefined ? String(initialData.purchasePrice) : "",
        salePrice: initialData?.salePrice !== undefined ? String(initialData.salePrice) : "",
        taxRate: initialData?.taxRate !== undefined ? String(initialData.taxRate) : "7",
        taxCode: initialData?.taxCode || "01",
        originCountry: initialData?.originCountry || "",
        initialQuantity: "",
        notes: "",
        image: initialData?.image || "",
        cpbsCode: initialData?.cpbsCode || "",
        cpbsUnit: initialData?.cpbsUnit || ""
    });

    const [showSecurityModal, setShowSecurityModal] = useState(false);
    const [pendingData, setPendingData] = useState<Partial<SerializedProduct> | null>(null);
    const [lastScannedField, setLastScannedField] = useState<string | null>(null);
    const [scannerTarget, setScannerTarget] = useState<'sku' | 'barcode' | null>(null);
    const [existingMatch, setExistingMatch] = useState<{ id: string; name: string; field: 'sku' | 'barcode' } | null>(null);

    // Validar duplicados en tiempo real (debounced)
    useEffect(() => {
        if (!formData.sku && !formData.barcode) return;

        const timer = setTimeout(async () => {
            const check = await checkDuplicateProductAction({
                sku: formData.sku || undefined,
                barcode: formData.barcode || undefined,
                excludeId: id
            });

            if (check.success && check.exists) {
                setFieldErrors(prev => ({
                    ...prev,
                    [check.field as string]: `Ya existe un producto (${check.name}) con este ${check.field}`
                }));
            } else {
                setFieldErrors(prev => {
                    const next = { ...prev };
                    delete next.sku;
                    delete next.barcode;
                    return next;
                });
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [formData.sku, formData.barcode, id]);

    // Efecto de feedback visual para scanner
    useEffect(() => {
        if (lastScannedField) {
            const timer = setTimeout(() => setLastScannedField(null), 1000);
            return () => clearTimeout(timer);
        }
    }, [lastScannedField]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        let processedValue = value;
        // Auto-formateo para SKU: Mayúsculas y sin espacios
        if (name === 'sku') {
            processedValue = value.toUpperCase().replace(/\s+/g, '');
        }

        setFormData(prev => ({ ...prev, [name]: processedValue }));

        // Limpiar error del campo al escribir
        if (fieldErrors[name]) {
            setFieldErrors(prev => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    // Manejar lectura desde el modal de cámara
    const handleScannedCode = async (code: string) => {
        const target = scannerTarget;
        if (!target || !code) return;

        // Format consistente con handleInputChange (SKU mayúsculas y sin espacios)
        const value = target === 'sku' ? code.toUpperCase().replace(/\s+/g, '') : code;

        setFormData(prev => ({ ...prev, [target]: value }));
        setLastScannedField(target);

        // Verificar si el producto ya existe
        const check = await checkDuplicateProductAction({
            [target]: value,
            excludeId: id,
        });

        if (check.success && check.exists && check.id) {
            setExistingMatch({ id: check.id, name: check.name || 'producto', field: check.field as 'sku' | 'barcode' });
            return;
        }

        setExistingMatch(null);

        // Si es nuevo, avanzar al siguiente campo lógico
        setTimeout(() => {
            if (target === 'sku') {
                document.getElementsByName('barcode')[0]?.focus();
            } else if (target === 'barcode') {
                document.getElementsByName('name')[0]?.focus();
            }
        }, 280);
    };

    // Manejar Enter (Scanner)
    const handleKeyDown = (e: React.KeyboardEvent, fieldName: string) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Evitar submit accidental

            // Feedback visual
            setLastScannedField(fieldName);

            // Lógica de salto automático
            if (fieldName === 'sku') {
                document.getElementsByName('barcode')[0]?.focus();
            } else if (fieldName === 'barcode') {
                if (currentStep === 1 && formData.name) {
                    nextStep();
                } else {
                    document.getElementsByName('name')[0]?.focus();
                }
            } else if (fieldName === 'name') {
                document.getElementsByName('brand')[0]?.focus();
            }
        }
    };

    const nextStep = () => {
        if (currentStep === 1) {
            if (!formData.name) {
                setError("El nombre del producto es obligatorio");
                return;
            }
            if (fieldErrors.sku || fieldErrors.barcode) {
                setError("Por favor corrija los errores de código duplicado");
                return;
            }
        }
        setError(null);
        setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    };

    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        // Validación final
        if (fieldErrors.sku || fieldErrors.barcode) {
            setError("Existen códigos duplicados en el sistema");
            return;
        }

        if (Number(formData.salePrice) <= 0) {
            setError("El precio de venta debe ser mayor a cero");
            return;
        }

        setError(null);

        const data = {
            ...formData,
            sku: formData.sku || undefined,
            barcode: formData.barcode || undefined,
            brand: formData.brand || undefined,
            category: formData.category || undefined,
            description: formData.description || undefined,
            purchasePrice: Number(formData.purchasePrice),
            salePrice: Number(formData.salePrice),
            taxRate: Number(formData.taxRate),
            weight: formData.weight || undefined,
            size: formData.size || undefined,
            color: formData.color || undefined,
            originCountry: formData.originCountry || undefined,
            initialQuantity: formData.initialQuantity ? Number(formData.initialQuantity) : undefined,
            notes: formData.notes || undefined,
            image: formData.image || undefined,
            cpbsCode: formData.cpbsCode || undefined,
            cpbsUnit: formData.cpbsUnit || undefined
        };

        if (id) {
            // If editing, show security modal
            setPendingData(data);
            setShowSecurityModal(true);
        } else {
            // If new, just register
            setLoading(true);
            const result = await registerProductAction(data);
            if (result.success) {
                router.push("/dashboard/inventory/productos");
                setTimeout(() => router.refresh(), 100);
            } else {
                setError(result.error || "Ocurrió un error");
                setLoading(false);
            }
        }
    }

    async function handleConfirmUpdate(password: string) {
        if (!id || !pendingData) return;

        setLoading(true);
        try {
            const result = await updateProductAction(id, { ...pendingData, password });
            if (result.success) {
                setShowSecurityModal(false);
                router.push("/dashboard/inventory/productos");
                setTimeout(() => router.refresh(), 100);
            } else {
                setError(result.error || "Error al actualizar");
                setShowSecurityModal(false);
                setLoading(false);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error desconocido");
            setLoading(false);
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Stepper Header */}
            <div className="mb-5 sm:mb-8">
                <div className="flex items-center justify-between">
                    {STEPS.map((step, idx) => {
                        const Icon = step.icon;
                        const isCompleted = currentStep > step.id;
                        const isActive = currentStep === step.id;

                        return (
                            <div key={step.id} className="flex items-center flex-1 last:flex-none">
                                <div className="flex flex-col items-center relative gap-1.5 sm:gap-2">
                                    <div className={cn(
                                        "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 z-10",
                                        isCompleted ? "bg-green-500 border-green-500 text-white" :
                                            isActive ? "bg-violet-600 border-violet-600 text-white shadow-lg shadow-violet-500/20 scale-110" :
                                                "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-gray-400"
                                    )}>
                                        {isCompleted ? <Check className="h-4 w-4 sm:h-5 sm:w-5" /> : <Icon className="h-4 w-4 sm:h-5 sm:w-5" />}
                                    </div>
                                    <span className={cn(
                                        "text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors",
                                        isActive ? "text-violet-600 dark:text-violet-400" : "text-gray-500"
                                    )}>
                                        {step.title}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className={cn(
                                        "h-[2px] flex-1 mx-2 sm:mx-4 mb-5 sm:mb-6 transition-colors duration-300",
                                        isCompleted ? "bg-green-500" : "bg-gray-200 dark:bg-slate-800"
                                    )} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl overflow-hidden">
                <form onSubmit={handleSubmit} className="p-8">
                    {error && (
                        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-red-600 text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Step 1: General Info */}
                    {currentStep === 1 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Existing product match banner */}
                            {existingMatch && (
                                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                                            Este {existingMatch.field === 'sku' ? 'SKU' : 'código'} ya existe en tu catálogo
                                        </p>
                                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                                            Producto: <span className="font-semibold">{existingMatch.name}</span>
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 mt-3">
                                            <Link
                                                href={`/dashboard/inventory/productos/${existingMatch.id}`}
                                                className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                Editar producto existente
                                                <ArrowRight className="h-3 w-3" />
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => setExistingMatch(null)}
                                                className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
                                            >
                                                Descartar y seguir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Image Upload Area */}
                            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-3xl bg-gray-50/50 dark:bg-slate-800/50 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group relative overflow-hidden">
                                {formData.image ? (
                                    <div className="relative w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden shadow-2xl">
                                        <ProductImage
                                            width={800}
                                            height={400}
                                            src={formData.image}
                                            alt="Product Preview"
                                            className="object-cover w-full h-full"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                            <ImageUpload
                                                value={formData.image}
                                                onChange={(publicId) => {
                                                    setFormData(prev => ({ ...prev, image: publicId }));
                                                }}
                                                onRemove={() => setFormData(prev => ({ ...prev, image: "" }))}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, image: "" }))}
                                                className="bg-red-500 text-white px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-red-600 transition-all z-20"
                                            >
                                                <X className="h-4 w-4" /> Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full py-4">
                                        <div className="flex flex-col items-center gap-4 mb-6">
                                            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                                                <ImageIcon className="h-8 w-8" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">Imagen del Producto</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG o WEBP (Máx. 5MB)</p>
                                            </div>
                                        </div>

                                        <ImageUpload
                                            value={formData.image}
                                            onChange={(publicId) => {
                                                setFormData(prev => ({ ...prev, image: publicId }));
                                            }}
                                            onRemove={() => setFormData(prev => ({ ...prev, image: "" }))}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nombre del Producto *</label>
                                        {mounted && id && initialData?.currentStock !== undefined && (
                                            <span className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 uppercase tracking-tighter">
                                                En Existencia: {Number(initialData.currentStock)} {initialData.unitType}
                                            </span>
                                        )}
                                    </div>
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        onKeyDown={(e) => handleKeyDown(e, 'name')}
                                        required
                                        autoComplete="off"
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 transition-all shadow-inner"
                                        placeholder="Ej: Pintura Latex Blanco"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Marca / Fabricante</label>
                                    <input
                                        name="brand"
                                        value={formData.brand}
                                        onChange={handleInputChange}
                                        autoComplete="off"
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 transition-all shadow-inner"
                                        placeholder="Ej: Glidden"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        SKU / Código Interno
                                        <span title="Identificador único para su inventario"><Info className="h-3 w-3 text-gray-400" /></span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            name="sku"
                                            value={formData.sku}
                                            onChange={handleInputChange}
                                            onKeyDown={(e) => handleKeyDown(e, 'sku')}
                                            autoComplete="off"
                                            className={cn(
                                                "w-full border-none rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 transition-all shadow-inner font-mono",
                                                fieldErrors.sku ? "bg-red-50 dark:bg-red-900/10 ring-2 ring-red-500" :
                                                    lastScannedField === 'sku' ? "bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-500" :
                                                        "bg-gray-50 dark:bg-slate-800 focus:ring-violet-500"
                                            )}
                                            placeholder="EJ: PINT-LAT-01"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setScannerTarget('sku')}
                                            aria-label="Escanear SKU con la cámara"
                                            title="Escanear con la cámara"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-8 w-8 rounded-lg text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/10 active:scale-95 transition-all"
                                        >
                                            <ScanLine className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {fieldErrors.sku && <p className="text-[10px] text-red-500 font-medium">{fieldErrors.sku}</p>}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Código de Barras (EAN/UPC)</label>
                                    <div className="relative">
                                        <input
                                            name="barcode"
                                            type="tel"
                                            value={formData.barcode}
                                            onChange={handleInputChange}
                                            onKeyDown={(e) => handleKeyDown(e, 'barcode')}
                                            autoComplete="off"
                                            className={cn(
                                                "w-full border-none rounded-xl px-4 py-3 pr-12 text-sm focus:ring-2 transition-all shadow-inner font-mono",
                                                fieldErrors.barcode ? "bg-red-50 dark:bg-red-900/10 ring-2 ring-red-500" :
                                                    lastScannedField === 'barcode' ? "bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-500" :
                                                        "bg-gray-50 dark:bg-slate-800 focus:ring-violet-500"
                                            )}
                                            placeholder="750123456789"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setScannerTarget('barcode')}
                                            aria-label="Escanear código de barras con la cámara"
                                            title="Escanear con la cámara"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-8 w-8 rounded-lg text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/10 active:scale-95 transition-all"
                                        >
                                            <ScanLine className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {fieldErrors.barcode && <p className="text-[10px] text-red-500 font-medium">{fieldErrors.barcode}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Specs */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Unidad de Medida (Estándar logística)</label>
                                    <select
                                        name="unitType"
                                        value={formData.unitType}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner"
                                    >
                                        {PANAMA_UNITS.map(unit => (
                                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Peso Neto</label>
                                    <input
                                        name="weight"
                                        value={formData.weight}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner"
                                        placeholder="Ej: 5 Gal"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tamaño / Talla</label>
                                    <input
                                        name="size"
                                        value={formData.size}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner"
                                        placeholder="Ej: Cubeta"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Color / Variante</label>
                                    <input
                                        name="color"
                                        value={formData.color}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner"
                                        placeholder="Ej: Blanco Hueso"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">País de Origen / Procedencia</label>
                                    <input
                                        name="originCountry"
                                        value={formData.originCountry}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner"
                                        placeholder="Ej: Panamá, USA"
                                    />
                                    <p className="text-[10px] text-gray-500 italic">Ej: Panamá, USA, China</p>
                                </div>
                            </div>

                            {/* CPBS Section */}
                            <div className="pt-6 border-t border-gray-100 dark:border-slate-800 space-y-4">
                                <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                                    <Globe className="h-4 w-4" />
                                    <h4 className="text-sm font-bold uppercase tracking-wider">Configuración CPBS (HKA / DGI)</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Código CPBS (C10 - 4 dígitos)</label>
                                        <input
                                            name="cpbsCode"
                                            value={formData.cpbsCode}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                                setFormData({ ...formData, cpbsCode: val });
                                            }}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner font-mono"
                                            placeholder="Ej: 8013"
                                            maxLength={4}
                                        />
                                        <p className="text-[10px] text-gray-500 italic">Debe ser un código de 4 dígitos del catálogo DGI.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Unidad CPBS</label>
                                        <select
                                            name="cpbsUnit"
                                            value={formData.cpbsUnit}
                                            onChange={handleInputChange}
                                            className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner"
                                        >
                                            <option value="">Seleccione unidad...</option>
                                            {CPBS_UNITS.map(unit => (
                                                <option key={unit.value} value={unit.value}>{unit.label}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-gray-500 italic">Unidad de medida según catálogo Tabla 29 DGI.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Pricing */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-mono flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" /> Costo Compra
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="purchasePrice"
                                        value={formData.purchasePrice}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner font-mono"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-mono flex items-center gap-1">
                                        <DollarSign className="h-3 w-3" /> Precio Venta *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="salePrice"
                                        value={formData.salePrice}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner font-mono"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">ITBMS Aplicable (%)</label>
                                    <select
                                        name="taxRate"
                                        value={formData.taxRate}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner"
                                    >
                                        <option value="7">ITBMS (7%)</option>
                                        <option value="10">ITBMS (10%)</option>
                                        <option value="15">ITBMS (15%)</option>
                                        <option value="0">EXENTO (0%)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Stock Inicial - Only show if registering a NEW product */}
                            {!id && (
                                <div className="pt-6 mt-6 border-t border-gray-50 dark:border-slate-800 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-2">
                                            <Package className="h-4 w-4" /> Saldo Inicial de Inventario
                                        </h4>
                                        <span className="text-[10px] bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-1 rounded-full font-bold">Opcional</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cantidad Existente</label>
                                            <input
                                                type="number"
                                                name="initialQuantity"
                                                value={formData.initialQuantity}
                                                onChange={handleInputChange}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 border-2 border-violet-100 dark:border-violet-900/30 font-bold"
                                                placeholder="Ej: 100"
                                            />
                                            <p className="text-[10px] text-gray-400">Se registrará como saldo inicial de apertura.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Documento de Referencia</label>
                                            <input
                                                name="notes"
                                                value={formData.notes}
                                                onChange={handleInputChange}
                                                className="w-full bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 shadow-inner"
                                                placeholder="Ej: Inventario Físico 2024"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="mt-12 flex justify-between items-center gap-4 border-t border-gray-50 dark:border-slate-800 pt-8">
                        {currentStep > 1 ? (
                            <button
                                type="button"
                                onClick={prevStep}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all border border-gray-100 dark:border-slate-800"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Anterior
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="px-6 py-3 rounded-xl font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Cancelar
                            </button>
                        )}

                        {currentStep < STEPS.length ? (
                            <button
                                type="button"
                                onClick={nextStep}
                                className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg active:scale-95"
                            >
                                Siguiente
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-10 py-3 rounded-xl font-bold transition-all shadow-lg shadow-violet-500/25 flex items-center gap-2 active:scale-95"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                {id ? "Actualizar Producto" : "Finalizar y Guardar"}
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <SecurityModal
                isOpen={showSecurityModal}
                onClose={() => setShowSecurityModal(false)}
                onConfirm={handleConfirmUpdate}
                title="Confirmar Actualización"
                description={`Se aplicarán los cambios al producto "${formData.name}". Por seguridad, ingrese su contraseña.`}
                actionLabel="Guardar Cambios"
                isLoading={loading}
            />

            <BarcodeScannerModal
                open={scannerTarget !== null}
                onOpenChange={(open) => { if (!open) setScannerTarget(null); }}
                onScan={handleScannedCode}
                title={scannerTarget === 'sku' ? 'Escanear SKU' : 'Escanear código de barras'}
                hint={scannerTarget === 'sku' ? 'Apunta al código del SKU interno' : 'Apunta al código EAN/UPC del producto'}
            />
        </div>
    );
}
