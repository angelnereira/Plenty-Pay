"use client";

import { useState } from "react";
import { X, Building2, Loader2 } from "lucide-react";
import { createSupplier } from "@/actions/supplier-actions";
import { toast } from "sonner";

interface QuickSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSupplierCreated: (supplier: any) => void;
}

export default function QuickSupplierModal({ isOpen, onClose, onSupplierCreated }: QuickSupplierModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        ruc: "",
        dv: "",
        email: "",
        phone: "",
        tier: "STANDARD" as const,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const newSupplier = await createSupplier(formData);
            toast.success("Proveedor creado exitosamente");
            onSupplierCreated(newSupplier);
            onClose();
            // Reset form
            setFormData({
                code: "",
                name: "",
                ruc: "",
                dv: "",
                email: "",
                phone: "",
                tier: "STANDARD",
            });
        } catch (error: any) {
            toast.error(error.message || "Error al crear proveedor");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/[0.08]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                            <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Nuevo Proveedor Rápido
                            </h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Datos básicos para crear el proveedor
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Código <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="code"
                                required
                                value={formData.code}
                                onChange={handleChange}
                                placeholder="PROV-001"
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Nombre <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Nombre del proveedor"
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    RUC
                                </label>
                                <input
                                    type="text"
                                    name="ruc"
                                    value={formData.ruc}
                                    onChange={handleChange}
                                    placeholder="2-123-456"
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    DV
                                </label>
                                <input
                                    type="text"
                                    name="dv"
                                    value={formData.dv}
                                    onChange={handleChange}
                                    placeholder="78"
                                    maxLength={2}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Categoría
                            </label>
                            <select
                                name="tier"
                                value={formData.tier}
                                onChange={handleChange}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            >
                                <option value="STRATEGIC">Estratégico</option>
                                <option value="PREFERRED">Preferido</option>
                                <option value="STANDARD">Estándar</option>
                                <option value="PROBATION">Prueba</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="contacto@proveedor.com"
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Teléfono
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="+507 6000-0000"
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                            💡 <strong>Nota:</strong> Este es un registro rápido. Puedes completar más información del proveedor desde el módulo de Proveedores después.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-white/[0.08]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Building2 className="h-4 w-4" />
                                    Crear Proveedor
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
