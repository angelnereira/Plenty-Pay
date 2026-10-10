'use server'

import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { Invoice } from "@prisma/client"
import { logger } from "@/lib/logger"
import { getAccumulatedItbms } from "@/lib/fiscal/itbms"

export type DashboardStats = {
    totalAmount: string
    totalInvoices: string
    certifiedInvoices: string
    pendingInvoices: string
    /** ITBMS acumulado a pagar (solo facturas de venta emitidas). */
    totalItbms: string
    billingCardMode?: 'DEFAULT' | 'DISCRETE' | 'HIDDEN' | 'MASKED'
}

export type ModuleStats = {
    inventory?: {
        totalProducts: number
        lowStockCount: number
        pendingOrders: number
    }
    pos?: {
        todaySales: number
        todayTransactions: number
    }
    payday?: {
        activeEmployees: number
        lastPayrollTotal: number
    }
    logistics?: {
        activeDeliveries: number
        pendingPickups: number
    }
}

export type DashboardData = {
    userName: string
    stats: DashboardStats
    moduleStats: ModuleStats
    invoices: Invoice[]
}

export async function getDashboardData(): Promise<{ success: boolean; data?: DashboardData; error?: string }> {
    try {
        const session = await auth()

        if (!session || !session.user || !session.user.clientId) {
            return { success: false, error: 'Unauthorized' }
        }

        const clientId = session.user.clientId
        logger.debug({ clientId }, '[Dashboard] Fetching data for clientId with optimized client')

        const successfulStatuses = ['EMITTED', 'CERTIFIED'] as const;

        // Use getPrismaData wrapper if strictly needed for serialization, 
        // but simple types like count/aggregate are usually fine.
        // For findMany (invoices) it's safer to use it to strip Proxies.

        const [totalInvoices, certifiedInvoices, pendingInvoices, totalAmount, totalItbmsValue, ultimasFacturasRaw, userData] = await Promise.all([
            prisma.invoice.count({ where: { clientId } }).catch(() => 0),
            prisma.invoice.count({
                where: {
                    clientId,
                    status: { in: [...successfulStatuses] }
                }
            }).catch(() => 0),
            prisma.invoice.count({
                where: {
                    clientId,
                    status: { in: ['DRAFT', 'PROCESSING', 'QUEUED'] }
                }
            }).catch(() => 0),
            prisma.invoice.aggregate({
                where: {
                    clientId,
                    status: { in: [...successfulStatuses] }
                },
                _sum: { total: true }
            }).catch(() => null),
            // ITBMS acumulado a pagar — solo facturas de venta emitidas con éxito.
            // Es una consulta aparte porque el filtro excluye notas/reembolsos.
            getAccumulatedItbms({ clientId }),
            prisma.invoice.findMany({
                where: { clientId },
                select: {
                    id: true,
                    invoiceNumber: true,
                    status: true,
                    total: true,
                    createdAt: true
                },
                take: 5,
                orderBy: { createdAt: "desc" },
            }).catch(() => []) as Promise<Invoice[]>,
            prisma.user.findUnique({ // Fetch user preferences
                where: { id: session.user.id },
                select: { metadata: true }
            }).catch(() => null)
        ])

        // Strip Proxies for serialization compatibility
        const ultimasFacturas = JSON.parse(JSON.stringify(ultimasFacturasRaw));
        const userMetadata = (userData?.metadata as Record<string, any>) || {};


        const totalAmountValue = (totalAmount as any)?._sum?.total
            ? Number((totalAmount as any)._sum.total.toString())
            : 0

        // Fetch module-specific stats in parallel based on enabled modules
        const moduleStats: ModuleStats = {}

        const moduleQueries: Promise<void>[] = []

        if (session.user.inventoryEnabled) {
            moduleQueries.push(
                Promise.all([
                    prisma.product.count({ where: { clientId, isActive: true } }).catch(() => 0),
                    // Stock bajo: comparación columna a columna (currentStock <= minStock).
                    // Prisma no expresa eso fluido en este modelo, por eso SQL crudo.
                    // CRÍTICO: la tabla real es "products" (lowercase, plural) por
                    // el @@map("products") del modelo Product en schema.prisma.
                    // Antes decía "Product" (PascalCase singular) y crasheaba con
                    // SQLSTATE 42P01 → bubble hasta el error boundary del dashboard.
                    prisma.$queryRawUnsafe<[{ count: bigint }]>(
                        `SELECT COUNT(*) as count FROM "products" WHERE "clientId" = $1 AND "isActive" = true AND "currentStock" <= "minStock"`,
                        clientId
                    ).then((r: Array<{ count: bigint }>) => Number(r[0]?.count ?? 0)).catch(() => 0),
                    prisma.purchaseOrder.count({
                        where: { clientId, status: { in: ['DRAFT', 'SENT', 'CONFIRMED'] } }
                    }).catch(() => 0),
                ]).then(([totalProducts, lowStockCount, pendingOrders]) => {
                    moduleStats.inventory = { totalProducts, lowStockCount, pendingOrders }
                })
            )
        }

        if (session.user.posEnabled) {
            const todayStart = new Date()
            todayStart.setHours(0, 0, 0, 0)
            moduleQueries.push(
                Promise.all([
                    prisma.invoice.aggregate({
                        where: {
                            clientId,
                            createdBy: { not: undefined },
                            documentType: 'FACTURA',
                            createdAt: { gte: todayStart },
                            status: { in: ['EMITTED', 'CERTIFIED', 'INTERNAL'] }
                        },
                        _sum: { total: true },
                        _count: { _all: true },
                    }).catch(() => null) as Promise<{ _sum: { total: unknown }; _count: { _all: number } } | null>,
                ]).then(([salesData]) => {
                    const totalDecimal = salesData?._sum?.total
                    moduleStats.pos = {
                        todaySales: totalDecimal ? Number((totalDecimal as { toString(): string }).toString()) : 0,
                        todayTransactions: salesData?._count?._all ?? 0,
                    }
                })
            )
        }

        if (session.user.paydayEnabled) {
            moduleQueries.push(
                Promise.all([
                    prisma.paydayEmployee.count({ where: { clientId, isActive: true } }).catch(() => 0),
                    prisma.paydayPayrollRun.findFirst({
                        where: { clientId, status: 'PAID' },
                        orderBy: { paidAt: 'desc' },
                        select: { totalNet: true },
                    }).catch(() => null),
                ]).then(([activeEmployees, lastPayroll]) => {
                    moduleStats.payday = {
                        activeEmployees,
                        lastPayrollTotal: lastPayroll?.totalNet ? Number(lastPayroll.totalNet.toString()) : 0,
                    }
                })
            )
        }

        if (session.user.logisticsEnabled) {
            moduleQueries.push(
                Promise.all([
                    prisma.deliveryOrder.count({
                        where: { clientId, status: { in: ['IN_TRANSIT', 'IN_PICKING'] } }
                    }).catch(() => 0),
                    prisma.deliveryOrder.count({
                        where: { clientId, status: { in: ['PENDING', 'READY_TO_SHIP'] } }
                    }).catch(() => 0),
                ]).then(([activeDeliveries, pendingPickups]) => {
                    moduleStats.logistics = { activeDeliveries, pendingPickups }
                })
            )
        }

        await Promise.all(moduleQueries)

        const dashboardData: DashboardData = {
            userName: session.user.name || "Usuario",
            stats: {
                totalAmount: totalAmountValue.toFixed(2),
                totalInvoices: totalInvoices.toString(),
                certifiedInvoices: certifiedInvoices.toString(),
                pendingInvoices: pendingInvoices.toString(),
                totalItbms: (totalItbmsValue ?? 0).toFixed(2),
                billingCardMode: userMetadata.billingCardMode || 'DEFAULT'
            },
            moduleStats,
            invoices: ultimasFacturas
        }

        return { success: true, data: dashboardData }
    } catch (error) {
        logger.error({ error }, '[Dashboard] Error fetching dashboard data')
        return { success: false, error: 'Failed to fetch dashboard data' }
    }
}
