"use client"

import { useState, useEffect } from "react"
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell
} from "recharts"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface AnalyticsChartsProps {
    dailyData: { date: string; amount: number; count: number }[]
    provinceData: { name: string; value: number }[]
    concurrencyData?: { time: string; users: number }[]
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"]

export function AnalyticsCharts({ dailyData, provinceData }: AnalyticsChartsProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <AnalyticsChartsSkeleton />
    }

    return (
        <div className="space-y-8">

            {/* Sales Trend */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-gray-100">Tendencia de Facturación (Últimos 30 días)</h3>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(val) => format(new Date(val), 'dd MMM', { locale: es })}
                                stroke="#6B7280"
                                fontSize={12}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#6B7280"
                                fontSize={12}
                                tickFormatter={(val) => `$${val}`}
                                axisLine={false}
                                tickLine={false}
                            />
                            <RechartsTooltip
                                contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                                itemStyle={{ color: '#F3F4F6' }}
                                formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Total Facturado"]}
                                labelFormatter={(label) => format(new Date(label), 'dd MMMM yyyy', { locale: es })}
                            />
                            <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Province Distribution */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-gray-100">Emisiones por Provincia</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={provinceData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {provinceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Volume Trend (Count) */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-gray-100">Volumen de Transacciones</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                                <XAxis dataKey="date" hide />
                                <YAxis />
                                <RechartsTooltip />
                                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

        </div>
    )
}

export function AnalyticsChartsSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm h-[450px]">
                <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
                <div className="h-[300px] w-full bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm h-[400px]">
                    <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
                    <div className="flex justify-center items-center h-[280px]">
                        <div className="h-48 w-48 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm h-[400px]">
                    <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
                    <div className="h-[280px] w-full bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
                </div>
            </div>
        </div>
    )
}
