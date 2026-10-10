import { auth } from "@core/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ArrowUpCircle, ArrowDownCircle, RefreshCcw, Plus, Filter, Search, Calendar } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const revalidate = 60; // P2 HAR cache improvement

export default async function MovementsPage() {
    const session = await auth();

    if (!session) {
        redirect("/");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user?.id },
        include: { client: true }
    });

    if (!user?.client) {
        redirect("/dashboard");
    }

    // Module access check - only allow if inventoryEnabled or user is SUPER_ADMIN
    if (!user.client.inventoryEnabled && session.user?.role !== "SUPER_ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-full mb-6">
                    <RefreshCcw className="h-12 w-12 text-amber-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Módulo no disponible
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
                    El módulo de control de inventario no está habilitado para su plan actual.
                    Contacte con soporte para activarlo.
                </p>
                <Link
                    href="/dashboard"
                    className="text-violet-600 hover:text-violet-700 font-medium"
                >
                    Volver al Inicio
                </Link>
            </div>
        );
    }

    const clientId = user.client.id;

    // Fetch all inventory transactions for this client
    const transactions = await prisma.inventoryTransaction.findMany({
        where: {
            product: {
                clientId: clientId
            }
        },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    sku: true,
                    unitType: true,
                    image: true
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 100 // Limit to last 100 transactions for performance
    });

    // Calculate stats
    const totalEntries = transactions.filter(t => t.type === 'ENTRY').length;
    const totalExits = transactions.filter(t => t.type === 'EXIT').length;
    const totalAdjustments = transactions.filter(t => t.type === 'ADJUST').length;

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent px-4 pt-4 md:px-8 md:pt-8 pb-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
                            Movimientos de Inventario
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg">
                            Historial completo de entradas, salidas y ajustes en tu inventario.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <Link href="/dashboard/inventory/movimientos/nuevo">
                            <button className="bg-violet-600 hover:bg-violet-700 text-white px-5 py-2.5 rounded-xl transition-all font-bold shadow-lg shadow-violet-500/20 flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Nuevo Movimiento
                            </button>
                        </Link>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="premium-card bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-transparent border-emerald-200 dark:border-emerald-500/20 p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl">
                                <ArrowUpCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Entradas</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{totalEntries}</p>
                            </div>
                        </div>
                    </div>

                    <div className="premium-card bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/20 dark:to-transparent border-rose-200 dark:border-rose-500/20 p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-2xl">
                                <ArrowDownCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Salidas</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{totalExits}</p>
                            </div>
                        </div>
                    </div>

                    <div className="premium-card bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/20 dark:to-transparent border-violet-200 dark:border-violet-500/20 p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-2xl">
                                <RefreshCcw className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Ajustes</p>
                                <p className="text-2xl font-black text-gray-900 dark:text-white">{totalAdjustments}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="premium-card p-6">
                    <div className="space-y-4">
                        {transactions.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="inline-flex p-4 rounded-full bg-gray-100 dark:bg-white/[0.05] mb-3">
                                    <RefreshCcw className="w-6 h-6 text-gray-400" />
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">No hay movimientos registrados.</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Los movimientos de inventario aparecerán aquí.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto scrollbar-hide">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-white/[0.08]">
                                            <th className="text-left py-3 px-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                            <th className="text-left py-3 px-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                                            <th className="text-left py-3 px-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                            <th className="text-right py-3 px-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cantidad</th>
                                            <th className="text-left py-3 px-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Motivo</th>
                                            <th className="text-left py-3 px-4 text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Referencia</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((transaction) => {
                                            const typeConfig = {
                                                ENTRY: {
                                                    label: 'Entrada',
                                                    icon: ArrowUpCircle,
                                                    color: 'text-emerald-600 dark:text-emerald-400',
                                                    bg: 'bg-emerald-100 dark:bg-emerald-900/30'
                                                },
                                                EXIT: {
                                                    label: 'Salida',
                                                    icon: ArrowDownCircle,
                                                    color: 'text-rose-600 dark:text-rose-400',
                                                    bg: 'bg-rose-100 dark:bg-rose-900/30'
                                                },
                                                ADJUST: {
                                                    label: 'Ajuste',
                                                    icon: RefreshCcw,
                                                    color: 'text-violet-600 dark:text-violet-400',
                                                    bg: 'bg-violet-100 dark:bg-violet-900/30'
                                                }
                                            }[transaction.type];

                                            const Icon = typeConfig.icon;

                                            return (
                                                <tr key={transaction.id} className="border-b border-gray-50 dark:border-white/[0.08]/50 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors">
                                                    <td className="py-4 px-4">
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                                {format(transaction.createdAt, 'dd MMM yyyy', { locale: es })}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                {format(transaction.createdAt, 'HH:mm')}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <Link href={`/dashboard/inventory/productos/${transaction.product.id}`} className="hover:text-violet-600 transition-colors">
                                                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                                                                {transaction.product.name}
                                                            </p>
                                                            {transaction.product.sku && (
                                                                <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                                                    SKU: {transaction.product.sku}
                                                                </p>
                                                            )}
                                                        </Link>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${typeConfig.bg}`}>
                                                            <Icon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
                                                            <span className={`text-xs font-bold ${typeConfig.color}`}>
                                                                {typeConfig.label}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-4 text-right">
                                                        <p className="text-sm font-black text-gray-900 dark:text-white">
                                                            {transaction.type === 'EXIT' ? '-' : '+'}{transaction.quantity.toString()} {transaction.product.unitType}
                                                        </p>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                                            {transaction.reason || 'Sin motivo especificado'}
                                                        </p>
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        {transaction.reference && (
                                                            <code className="text-xs font-mono bg-gray-100 dark:bg-white/[0.05] px-2 py-1 rounded">
                                                                {transaction.reference}
                                                            </code>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
