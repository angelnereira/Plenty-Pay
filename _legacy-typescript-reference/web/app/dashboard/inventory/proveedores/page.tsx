import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SupplierService } from "@/features/inventory/model/services/supplier.service";
import { Users, Plus, Search, Filter, Building2, Star, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { jsonify } from "@/lib/serialize";

// Tier badge configuration
const tierConfig: Record<string, { label: string; className: string }> = {
    STRATEGIC: { label: "Estratégico", className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400" },
    PREFERRED: { label: "Preferido", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    STANDARD: { label: "Estándar", className: "bg-slate-100 text-slate-800 dark:bg-white/[0.05] dark:text-slate-300" },
    PROBATION: { label: "Prueba", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
};

export default async function SuppliersPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { client: true }
    });

    if (!user?.client || (!user.client.inventoryEnabled && session.user?.role !== "SUPER_ADMIN")) {
        redirect("/dashboard/inventory");
    }

    const supplierService = new SupplierService();
    const [suppliers, stats] = await Promise.all([
        supplierService.listSuppliers(user.client.id),
        supplierService.getSupplierStats(user.client.id),
    ]);

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                            <Link href="/dashboard/inventory" className="hover:text-violet-600">Inventario</Link>
                            <span>/</span>
                            <span className="text-gray-900 dark:text-white">Proveedores</span>
                        </nav>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
                            Proveedores
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg">
                            Gestiona tus proveedores, evalúa su rendimiento y vincula productos para agilizar las compras.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            href="/dashboard/inventory/proveedores/nuevo"
                            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo Proveedor
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="premium-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                                <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                            </div>
                        </div>
                    </div>
                    <div className="premium-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Activos</p>
                            </div>
                        </div>
                    </div>
                    <div className="premium-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.byTier?.STRATEGIC || 0}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Estratégicos</p>
                            </div>
                        </div>
                    </div>
                    <div className="premium-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.byTier?.PROBATION || 0}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">En Prueba</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Suppliers List */}
                <div className="premium-card overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-white/[0.1] flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            Lista de Proveedores
                        </h2>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    className="pl-9 pr-4 py-2 text-sm bg-gray-100 dark:bg-white/[0.05] border-0 rounded-lg focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-white/[0.05]">
                                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    <th className="px-4 py-3">Código</th>
                                    <th className="px-4 py-3">Nombre</th>
                                    <th className="px-4 py-3">Contacto</th>
                                    <th className="px-4 py-3">Tier</th>
                                    <th className="px-4 py-3">Lead Time</th>
                                    <th className="px-4 py-3">Productos</th>
                                    <th className="px-4 py-3">Órdenes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                {suppliers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center">
                                            <Building2 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                            <p className="text-gray-500 dark:text-gray-400">
                                                No hay proveedores registrados
                                            </p>
                                            <Link
                                                href="/dashboard/inventory/proveedores/nuevo"
                                                className="text-violet-600 hover:text-violet-700 font-medium text-sm mt-2 inline-block"
                                            >
                                                Agregar primer proveedor
                                            </Link>
                                        </td>
                                    </tr>
                                ) : (
                                    suppliers.map((supplier: any) => {
                                        const tier = tierConfig[supplier.tier] || tierConfig.STANDARD;
                                        return (
                                            <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-sm text-gray-900 dark:text-white">
                                                        {supplier.code}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Link
                                                        href={`/dashboard/inventory/proveedores/${supplier.id}`}
                                                        className="font-medium text-gray-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400"
                                                    >
                                                        {supplier.name}
                                                    </Link>
                                                    {supplier.tradeName && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            {supplier.tradeName}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                    {supplier.email || supplier.phone || "-"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${tier.className}`}>
                                                        {tier.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                    {supplier.defaultLeadTimeDays} días
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                    {supplier._count?.supplierProducts || 0}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                    {supplier._count?.purchaseOrders || 0}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
