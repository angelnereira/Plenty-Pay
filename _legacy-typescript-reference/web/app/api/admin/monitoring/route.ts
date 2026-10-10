import { NextRequest, NextResponse } from "next/server"
import { auth } from "@core/auth"
import { prisma } from "@core/database"
import { subDays, startOfDay, endOfDay } from "date-fns"

export async function GET(request: NextRequest) {
    try {
        const session = await auth()

        if (!session?.user || session.user.role !== "SUPER_ADMIN") {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const range = searchParams.get("range") || "7d" // 24h, 7d, 30d

        let startDate = subDays(new Date(), 7)
        if (range === "24h") startDate = subDays(new Date(), 1)
        if (range === "30d") startDate = subDays(new Date(), 30)

        const startOfRange = startOfDay(startDate)

        // 1. Usuarios activos (que han iniciado sesión en el rango)
        const activeUsersCount = await prisma.user.count({
            where: {
                lastLoginAt: { gte: startOfRange },
            },
        })

        // 2. Transacciones totales en el rango
        const totalTransactions = await prisma.invoice.count({
            where: {
                createdAt: { gte: startOfRange },
            },
        })

        // 3. Transacciones por usuario (Top 10)
        const transactionsByUser = await prisma.invoice.groupBy({
            by: ["createdBy"],
            _count: {
                id: true,
            },
            where: {
                createdAt: { gte: startOfRange },
            },
            orderBy: {
                _count: {
                    id: "desc",
                },
            },
            take: 10,
        }) as any[]

        // Obtener nombres de los usuarios para transactionsByUser
        const userIds = transactionsByUser.map(t => t.createdBy)
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true }
        })

        const transactionsWithUserInfo = transactionsByUser.map(t => ({
            ...t,
            user: users.find(u => u.id === t.createdBy)
        }))

        // 4. Tendencia diaria (Transacciones por día)
        const invoicesTrend = await prisma.invoice.findMany({
            where: {
                createdAt: { gte: startOfRange },
            },
            select: {
                createdAt: true,
                total: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        })

        // Agrupar por día para el gráfico
        const trendMap = new Map<string, { date: string; count: number; amount: number }>()

        // Inicializar el mapa con todos los días en el rango
        for (let i = 0; i <= (range === "24h" ? 1 : range === "7d" ? 7 : 30); i++) {
            const date = subDays(new Date(), i)
            const dateStr = startOfDay(date).toISOString()
            trendMap.set(dateStr, { date: dateStr, count: 0, amount: 0 })
        }

        invoicesTrend.forEach(inv => {
            const dateStr = startOfDay(inv.createdAt).toISOString()
            const current = trendMap.get(dateStr) || { date: dateStr, count: 0, amount: 0 }
            trendMap.set(dateStr, {
                date: dateStr,
                count: current.count + 1,
                amount: current.amount + Number(inv.total),
            })
        })

        const dailyTrend = Array.from(trendMap.values()).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )

        return NextResponse.json({
            success: true,
            data: {
                activeUsersCount,
                totalTransactions,
                transactionsByUser: transactionsWithUserInfo,
                dailyTrend,
            },
        })
    } catch (error: any) {
        console.error("[MONITORING_API_ERROR]", error)
        return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
    }
}
