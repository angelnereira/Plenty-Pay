import { auth } from "@core/auth"
import { prismaServer as prisma } from "@core/database"
import { redirect } from "next/navigation"
import { AnalyticsCharts } from "@/features/admin/ui/analytics-charts"
import { TrendingUp, DollarSign, FileText, Map } from "lucide-react"

export const metadata = {
    title: "Business Intelligence | PlentyPay Admin",
}

export default async function AnalyticsPage() {
    const session = await auth()

    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
        redirect("/dashboard")
    }

    // Range: Last 30 Days
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - 30)

    // Fetch Invoices
    const invoices = await prisma.invoice.findMany({
        where: {
            issueDate: { gte: dateFrom },
            status: { not: "CANCELLED" }
        },
        select: {
            issueDate: true,
            total: true,
            customer: {
                select: { province: true }
            }
        },
        orderBy: { issueDate: 'asc' }
    })

    // Aggregation Logic (Client-side style processing on Server for efficiency)
    const groupedByDate: Record<string, { date: string; amount: number; count: number }> = {}
    const groupedByProvince: Record<string, number> = {}

    let totalRevenue = 0
    let totalCount = 0

    invoices.forEach(inv => {
        // Daily Trend
        const dateKey = inv.issueDate.toISOString().split('T')[0] // YYYY-MM-DD
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = { date: dateKey, amount: 0, count: 0 }
        }
        const amount = Number(inv.total)
        groupedByDate[dateKey].amount += amount
        groupedByDate[dateKey].count += 1

        // Totals
        totalRevenue += amount
        totalCount += 1

        // Province
        const prov = inv.customer?.province || "DESCONOCIDO"
        groupedByProvince[prov] = (groupedByProvince[prov] || 0) + 1
    })

    // Format for Charts
    const dailyData = Object.values(groupedByDate).sort((a, b) => a.date.localeCompare(b.date))

    const provinceData = Object.entries(groupedByProvince)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10) // Top 10

    // MRR Calculation (Alineado con el Hero Page)
    const clients = await prisma.client.findMany({
        where: { deletedAt: null, isActive: true },
        select: { planType: true }
    })

    const planPrices: Record<string, number> = {
        "CRECIMIENTO": 49.99,
        "PROFESIONAL": 99.99,
        "EMPRESARIAL": 199.99,
        "ENTERPRISE": 249.00
    }

    let mrr = 0
    clients.forEach(c => {
        mrr += planPrices[c.planType] || 49.99 // Default to Crecimiento price
    })

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 flex items-center gap-3">
                    <TrendingUp className="h-10 w-10 text-violet-600" />
                    Business Intelligence
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium italic">
                    Análisis transaccional y proyección de ingresos recurrentes
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center group hover:border-violet-500 transition-all">
                    <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-full mr-4 group-hover:scale-110 transition-transform">
                        <DollarSign className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">MRR Estimado</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">${mrr.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center group">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full mr-4 group-hover:scale-110 transition-transform">
                        <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Transaccional (30d)</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center group">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full mr-4 group-hover:scale-110 transition-transform">
                        <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Facturas (30d)</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100">{totalCount}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center group">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full mr-4 group-hover:scale-110 transition-transform">
                        <Map className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Top Provincia</p>
                        <p className="text-2xl font-black text-gray-900 dark:text-gray-100 truncate max-w-[120px]">{provinceData[0]?.name || "N/A"}</p>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <AnalyticsCharts dailyData={dailyData} provinceData={provinceData} />
        </div>
    )
}
