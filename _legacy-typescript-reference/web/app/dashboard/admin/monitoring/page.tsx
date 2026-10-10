"use client"

import { useState, useEffect } from "react"
import {
    Users,
    FileText,
    TrendingUp,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    UserCheck,
    Loader2
} from "lucide-react"
import { AnalyticsCharts } from "@/features/admin/ui/analytics-charts"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function MonitoringPage() {
    const [range, setRange] = useState("7d")
    const [isLoading, setIsLoading] = useState(true)
    const [data, setData] = useState<any>(null)

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true)
            try {
                const res = await fetch(`/api/admin/monitoring?range=${range}`)
                const result = await res.json()
                if (result.success) {
                    setData(result.data)
                }
            } catch (e) {
                console.error("Error fetching monitoring data", e)
            } finally {
                setIsLoading(false)
            }
        }
        fetchData()
    }, [range])

    if (isLoading && !data) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                        <Activity className="h-8 w-8 text-primary" />
                        Monitoreo del Sistema
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Estado en tiempo real de usuarios y transacciones
                    </p>
                </div>

                <div className="flex items-center bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                    {["24h", "7d", "30d"].map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${range === r
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                }`}
                        >
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <UserCheck className="h-12 w-12 text-blue-500" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Usuarios Activos</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{data?.activeUsersCount}</p>
                    <div className="mt-4 flex items-center text-green-600 dark:text-green-400 text-xs font-semibold">
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        <span>Vistos en el periodo</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                        <FileText className="h-12 w-12 text-primary" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Volumen Transaccional</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{data?.totalTransactions}</p>
                    <div className="mt-4 flex items-center text-violet-600 dark:text-violet-400 text-xs font-semibold">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        <span>Facturas generadas</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">SLA Promedio</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">99.9%</p>
                    <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 text-xs font-semibold">
                        <div className="h-1.5 w-full bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full w-[99.9%]"></div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Uptime API HKA</p>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">ÓPTIMO</p>
                    <div className="mt-4 flex items-center gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                            <div key={i} className="h-4 w-1.5 bg-green-500 rounded-full"></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <AnalyticsCharts
                        dailyData={data?.dailyTrend || []}
                        provinceData={[]}
                    />
                </div>

                <div className="space-y-6">
                    {/* Top Users List */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                            <Users className="h-5 w-5 text-gray-400" />
                            Actividad por Usuario
                        </h3>
                        <div className="space-y-4">
                            {data?.transactionsByUser?.map((t: any, idx: number) => (
                                <div key={t.createdBy} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-500">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                                                {t.user?.name || "Desconocido"}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {t.user?.email || "No email"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-primary">{t._count.id} tx</div>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-tighter">Transacciones</p>
                                    </div>
                                </div>
                            ))}
                            {data?.transactionsByUser?.length === 0 && (
                                <p className="text-center text-sm text-gray-400 py-10 italic">Sin actividad registrada en este periodo</p>
                            )}
                        </div>
                    </div>

                    {/* Quick System Health */}
                    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 rounded-xl border border-white/10 shadow-xl text-white">
                        <h4 className="font-bold text-sm uppercase tracking-widest mb-4 opacity-70">Salud del Entorno</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                                <span className="text-xs">Database Conn.</span>
                                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse ring-4 ring-green-400/20"></span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                                <span className="text-xs">Cron Jobs</span>
                                <span className="text-xs font-mono">Running OK</span>
                            </div>
                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                                <span className="text-xs">Storage S3/Uploads</span>
                                <span className="text-xs font-mono">94% Free</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
