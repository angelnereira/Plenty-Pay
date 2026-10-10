"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Save, Loader2 } from "lucide-react";
import Link from "next/link";
import { createSupplier } from "@/actions/supplier-actions";
import { toast } from "sonner";

export default function NuevoProveedorForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        code: "",
        name: "",
        tradeName: "",
        ruc: "",
        dv: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        country: "PA",
        contactName: "",
        contactPhone: "",
        contactEmail: "",
        website: "",
        paymentTerms: "NET30",
        creditLimit: "",
        currency: "USD",
        bankAccount: "",
        bankName: "",
        defaultLeadTimeDays: "7",
        category: "",
        tier: "STANDARD" as const,
        certifications: [] as string[],
        notes: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const submitData = {
                ...formData,
                creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
                defaultLeadTimeDays: parseInt(formData.defaultLeadTimeDays) || 7,
            };

            await createSupplier(submitData);
            toast.success("Proveedor creado exitosamente");
            router.push("/dashboard/inventory/proveedores");
        } catch (error: any) {
            toast.error(error.message || "Error al crear proveedor");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Información Básica */}
            <div className="premium-card p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-violet-600" />
                    Información Básica
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nombre Legal <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Distribuidora Nacional S.A."
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nombre Comercial
                        </label>
                        <input
                            type="text"
                            name="tradeName"
                            value={formData.tradeName}
                            onChange={handleChange}
                            placeholder="DistriNacional"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                                className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tier/Categoría
                        </label>
                        <select
                            name="tier"
                            value={formData.tier}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                            <option value="STRATEGIC">Estratégico</option>
                            <option value="PREFERRED">Preferido</option>
                            <option value="STANDARD">Estándar</option>
                            <option value="PROBATION">Prueba</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Categoría
                        </label>
                        <input
                            type="text"
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            placeholder="Materias Primas, Servicios, etc."
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>
                </div>
            </div>

            {/* Contacto */}
            <div className="premium-card p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                    Información de Contacto
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Email Principal
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="contacto@proveedor.com"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Teléfono Principal
                        </label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+507 6000-0000"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Persona de Contacto
                        </label>
                        <input
                            type="text"
                            name="contactName"
                            value={formData.contactName}
                            onChange={handleChange}
                            placeholder="Juan Pérez"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Teléfono de Contacto
                        </label>
                        <input
                            type="tel"
                            name="contactPhone"
                            value={formData.contactPhone}
                            onChange={handleChange}
                            placeholder="+507 6000-0000"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Dirección
                        </label>
                        <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Calle 50, Edificio Delta, Piso 5"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Ciudad
                        </label>
                        <input
                            type="text"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            placeholder="Ciudad de Panamá"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            País
                        </label>
                        <select
                            name="country"
                            value={formData.country}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                            <option value="PA">Panamá</option>
                            <option value="US">Estados Unidos</option>
                            <option value="CO">Colombia</option>
                            <option value="CR">Costa Rica</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Términos Comerciales */}
            <div className="premium-card p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                    Términos Comerciales
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Términos de Pago
                        </label>
                        <select
                            name="paymentTerms"
                            value={formData.paymentTerms}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
                            Límite de Crédito (USD)
                        </label>
                        <input
                            type="number"
                            name="creditLimit"
                            value={formData.creditLimit}
                            onChange={handleChange}
                            placeholder="10000.00"
                            step="0.01"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tiempo de Entrega (días)
                        </label>
                        <input
                            type="number"
                            name="defaultLeadTimeDays"
                            value={formData.defaultLeadTimeDays}
                            onChange={handleChange}
                            min="1"
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Moneda
                        </label>
                        <select
                            name="currency"
                            value={formData.currency}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                            <option value="USD">USD - Dólar</option>
                            <option value="PAB">PAB - Balboa</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Notas */}
            <div className="premium-card p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                    Notas Adicionales
                </h2>
                <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Comentarios, instrucciones especiales, etc."
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
                <Link
                    href="/dashboard/inventory/proveedores"
                    className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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
                            Guardando...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            Guardar Proveedor
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
