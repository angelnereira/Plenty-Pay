import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PurchaseOrderService } from "@/features/inventory/model/services/purchase-order.service";
import { ShoppingCart, Plus, Search, Clock, CheckCircle, XCircle, Truck, FileText } from "lucide-react";
import Link from "next/link";
import { jsonify } from "@/lib/serialize";

// Status configuration
const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
    DRAFT: { label: "Borrador", icon: FileText, className: "bg-slate-100 text-slate-800 dark:bg-white/[0.05] dark:text-slate-300" },
    SENT: { label: "Enviada", icon: Clock, className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    CONFIRMED: { label: "Confirmada", icon: CheckCircle, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
    PARTIAL_RECEIVED: { label: "Parcial", icon: Truck, className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
    RECEIVED: { label: "Recibida", icon: CheckCircle, className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    CLOSED: { label: "Cerrada", icon: CheckCircle, className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400" },
    CANCELLED: { label: "Cancelada", icon: XCircle, className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export default async function PurchaseOrdersPage() {
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

    const poService = new PurchaseOrderService();
    const [orders, stats] = await Promise.all([
        poService.listPurchaseOrders(user.client.id),
        poService.getStats(user.client.id),
    ]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-PA', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('es-PA', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }).format(new Date(date));
    };

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                            <Link href="/dashboard/inventory" className="hover:text-violet-600">Inventario</Link>
                            <span>/</span>
                            <span className="text-gray-900 dark:text-white">Órdenes de Compra</span>
                        </nav>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
                            Órdenes de Compra
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg">
                            Crea, rastrea y gestiona todas las órdenes de compra a proveedores.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Link
                            href="/dashboard/inventory/ordenes-compra/nueva"
                            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Nueva Orden
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="premium-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                                <ShoppingCart className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                            </div>
                        </div>
                    </div>
                    <div className="premium-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {(stats.byStatus?.SENT || 0) + (stats.byStatus?.CONFIRMED || 0)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
                            </div>
                        </div>
                    </div>
                    <div className="premium-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.thisMonth?.count || 0}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Este Mes</p>
                            </div>
                        </div>
                    </div>
                    <div className="premium-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <Truck className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(stats.thisMonth?.total || 0)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Valor Mes</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Orders List */}
                <div className="premium-card overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-white/[0.1] flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            Órdenes Recientes
                        </h2>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar PO..."
                                    className="pl-9 pr-4 py-2 text-sm bg-gray-100 dark:bg-white/[0.05] border-0 rounded-lg focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-white/[0.05]">
                                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                    <th className="px-4 py-3">No. Orden</th>
                                    <th className="px-4 py-3">Proveedor</th>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Items</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/[0.08]">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-12 text-center">
                                            <ShoppingCart className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                                            <p className="text-gray-500 dark:text-gray-400">
                                                No hay órdenes de compra
                                            </p>
                                            <Link
                                                href="/dashboard/inventory/ordenes-compra/nueva"
                                                className="text-violet-600 hover:text-violet-700 font-medium text-sm mt-2 inline-block"
                                            >
                                                Crear primera orden
                                            </Link>
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map((order: any) => {
                                        const status = statusConfig[order.status] || statusConfig.DRAFT;
                                        const StatusIcon = status.icon;
                                        return (
                                            <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors">
                                                <td className="px-4 py-3">
                                                    <Link
                                                        href={`/dashboard/inventory/ordenes-compra/${order.id}`}
                                                        className="font-mono text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
                                                    >
                                                        {order.poNumber}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-gray-900 dark:text-white">
                                                        {order.supplier?.name || "-"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                    {formatDate(order.orderDate)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                                                        <StatusIcon className="h-3 w-3" />
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                    {order._count?.items || 0}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white text-right">
                                                    {formatCurrency(Number(order.total))}
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
