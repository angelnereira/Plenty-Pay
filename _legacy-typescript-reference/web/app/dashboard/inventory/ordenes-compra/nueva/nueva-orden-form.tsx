"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Plus, Trash2, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { createPurchaseOrder } from "@/actions/purchase-order-actions";
import { listSuppliers } from "@/actions/supplier-actions";
import { toast } from "sonner";
import QuickSupplierModal from "./quick-supplier-modal";

interface POItem {
    id: string;
    productId: string;
    description: string;
    quantityOrdered: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
    unit: string;
    notes: string;
}

export default function NuevaOrdenCompraForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [suppliers, setSuppliers] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        supplierId: "",
        expectedDate: "",
        shippingAddress: "",
        shippingMethod: "",
        paymentTerms: "NET30",
        paymentMethod: "",
        currency: "USD",
        notes: "",
        internalNotes: "",
    });

    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

    const [items, setItems] = useState<POItem[]>([
        {
            id: crypto.randomUUID(),
            productId: "",
            description: "",
            quantityOrdered: 1,
            unitPrice: 0,
            discount: 0,
            taxRate: 7,
            unit: "UND",
            notes: "",
        }
    ]);

    useEffect(() => {
        const fetchSuppliers = async () => {
            try {
                const data = await listSuppliers({ isActive: true });
                setSuppliers(data);
            } catch (error) {
                console.error("Error loading suppliers:", error);
            } finally {
                setLoadingSuppliers(false);
            }
        };
        fetchSuppliers();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (id: string, field: keyof POItem, value: any) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const addItem = () => {
        setItems(prev => [...prev, {
            id: crypto.randomUUID(),
            productId: "",
            description: "",
            quantityOrdered: 1,
            unitPrice: 0,
            discount: 0,
            taxRate: 7,
            unit: "UND",
            notes: "",
        }]);
    };

    const removeItem = (id: string) => {
        if (items.length > 1) {
            setItems(prev => prev.filter(item => item.id !== id));
        }
    };

    const calculateItemTotal = (item: POItem) => {
        const subtotal = item.quantityOrdered * item.unitPrice;
        const afterDiscount = subtotal - item.discount;
        const tax = afterDiscount * (item.taxRate / 100);
        return afterDiscount + tax;
    };

    const calculateTotals = () => {
        const subtotal = items.reduce((sum, item) => sum + (item.quantityOrdered * item.unitPrice), 0);
        const totalDiscount = items.reduce((sum, item) => sum + item.discount, 0);
        const totalTax = items.reduce((sum, item) => {
            const afterDiscount = (item.quantityOrdered * item.unitPrice) - item.discount;
            return sum + (afterDiscount * (item.taxRate / 100));
        }, 0);
        const total = subtotal - totalDiscount + totalTax;

        return { subtotal, totalDiscount, totalTax, total };
    };

    const handleSupplierCreated = (newSupplier: any) => {
        // Add to suppliers list
        setSuppliers(prev => [...prev, newSupplier]);
        // Auto-select the new supplier
        setFormData(prev => ({ ...prev, supplierId: newSupplier.id }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.supplierId) {
            toast.error("Debe seleccionar un proveedor");
            return;
        }

        if (items.length === 0 || !items[0].description) {
            toast.error("Debe agregar al menos un item");
            return;
        }

        setLoading(true);

        try {
            const submitData = {
                supplierId: formData.supplierId,
                expectedDate: formData.expectedDate ? new Date(formData.expectedDate) : undefined,
                shippingAddress: formData.shippingAddress,
                shippingMethod: formData.shippingMethod,
                paymentTerms: formData.paymentTerms,
                paymentMethod: formData.paymentMethod,
                currency: formData.currency,
                notes: formData.notes,
                internalNotes: formData.internalNotes,
                items: items.map(item => ({
                    productId: item.productId || undefined,
                    description: item.description,
                    unit: item.unit,
                    quantityOrdered: item.quantityOrdered,
                    unitPrice: item.unitPrice,
                    discount: item.discount,
                    taxRate: item.taxRate,
                    notes: item.notes,
                })),
            };

            await createPurchaseOrder(submitData);
            toast.success("Orden de compra creada exitosamente");
            router.push("/dashboard/inventory/ordenes-compra");
        } catch (error: any) {
            toast.error(error.message || "Error al crear orden de compra");
        } finally {
            setLoading(false);
        }
    };

    const totals = calculateTotals();

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Información General */}
            <div className="premium-card p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-violet-600" />
                    Información General
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Proveedor <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                            <select
                                name="supplierId"
                                required
                                value={formData.supplierId}
                                onChange={handleChange}
                                disabled={loadingSuppliers}
                                className="flex-1 px-4 py-2 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            >
                                <option value="">Seleccionar proveedor...</option>
                                {suppliers.map(supplier => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.code} - {supplier.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setIsSupplierModalOpen(true)}
                                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                                title="Agregar nuevo proveedor"
                            >
                                <Plus className="h-4 w-4" />
                                <span className="hidden sm:inline">Nuevo</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Fecha Esperada de Entrega
                        </label>
                        <input
                            type="date"
                            name="expectedDate"
                            value={formData.expectedDate}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Términos de Pago
                        </label>
                        <select
                            name="paymentTerms"
                            value={formData.paymentTerms}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                            <option value="CASH">Contado</option>
                            <option value="NET15">Neto 15 días</option>
                            <option value="NET30">Neto 30 días</option>
                            <option value="NET60">Neto 60 días</option>
                            <option value="NET90">Neto 90 días</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Moneda
                        </label>
                        <select
                            name="currency"
                            value={formData.currency}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                            <option value="USD">USD - Dólar</option>
                            <option value="PAB">PAB - Balboa</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Dirección de Entrega
                        </label>
                        <input
                            type="text"
                            name="shippingAddress"
                            value={formData.shippingAddress}
                            onChange={handleChange}
                            placeholder="Dirección completa de entrega"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Items */}
            <div className="premium-card p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Items de la Orden
                    </h2>
                    <button
                        type="button"
                        onClick={addItem}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Agregar Item
                    </button>
                </div>

                <div className="space-y-4">
                    {items.map((item, index) => (
                        <div key={item.id} className="p-4 bg-gray-50 dark:bg-white/[0.05] rounded-lg border border-gray-200 dark:border-white/[0.1]">
                            <div className="flex items-start justify-between mb-4">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Item #{index + 1}
                                </span>
                                {items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.id)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Descripción
                                    </label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                        placeholder="Descripción del producto/servicio"
                                        required
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Cantidad
                                    </label>
                                    <input
                                        type="number"
                                        value={item.quantityOrdered}
                                        onChange={(e) => handleItemChange(item.id, 'quantityOrdered', parseFloat(e.target.value))}
                                        min="0.01"
                                        step="0.01"
                                        required
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Unit
                                    </label>
                                    <select
                                        value={item.unit}
                                        onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)}
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500"
                                    >
                                        <option value="UND">UND</option>
                                        <option value="CAJA">CAJA</option>
                                        <option value="KG">KG</option>
                                        <option value="LB">LB</option>
                                        <option value="L">L</option>
                                        <option value="GAL">GAL</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                        Precio Unit.
                                    </label>
                                    <input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value))}
                                        min="0"
                                        step="0.01"
                                        required
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500"
                                    />
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Total item:</span>
                                <span className="font-bold text-gray-900 dark:text-white">
                                    ${calculateItemTotal(item).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/[0.1]">
                    <div className="max-w-md ml-auto space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                ${totals.subtotal.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Descuentos:</span>
                            <span className="text-green-600 dark:text-green-400">
                                -${totals.totalDiscount.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Impuestos:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                                ${totals.totalTax.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-white/[0.1]">
                            <span className="text-gray-900 dark:text-white">TOTAL:</span>
                            <span className="text-violet-600 dark:text-violet-400">
                                ${totals.total.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notas */}
            <div className="premium-card p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                    Notas
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Notas para el Proveedor
                        </label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows={4}
                            placeholder="Instrucciones especiales, condiciones, etc."
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Notas Internas
                        </label>
                        <textarea
                            name="internalNotes"
                            value={formData.internalNotes}
                            onChange={handleChange}
                            rows={4}
                            placeholder="Comentarios privados, no visibles para el proveedor"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
                <Link
                    href="/dashboard/inventory/ordenes-compra"
                    className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                    Cancelar
                </Link>
                <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creando...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            Crear Orden de Compra
                        </>
                    )}
                </button>
            </div>

            {/* Quick Supplier Modal */}
            <QuickSupplierModal
                isOpen={isSupplierModalOpen}
                onClose={() => setIsSupplierModalOpen(false)}
                onSupplierCreated={handleSupplierCreated}
            />
        </form>
    );
}
