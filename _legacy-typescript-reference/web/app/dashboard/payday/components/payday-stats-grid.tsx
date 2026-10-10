"use client"

import { Clock, Users, DollarSign, AlertTriangle } from "lucide-react"
import { KPICard } from "@/components/dashboard/kpi-card"

interface PaydayStatsGridProps {
    stats: {
        activeEmployeeCount: number
        weeklyHours: {
            regular: number
            overtime: number
        }
        estimatedPayroll?: number
    }
}

export function PaydayStatsGrid({ stats }: PaydayStatsGridProps) {
    const kpiData = [
        {
            icon: Users,
            title: "Activos Ahora",
            value: stats.activeEmployeeCount,
            description: "Empleados en turno",
            borderColor: "border-l-blue-500"
        },
        {
            icon: Clock,
            title: "Horas Semana",
            value: stats.weeklyHours.regular.toFixed(1),
            description: "Horas regulares acumuladas",
            borderColor: "border-l-indigo-500"
        },
        {
            icon: AlertTriangle,
            title: "Horas Extras",
            value: stats.weeklyHours.overtime.toFixed(1),
            description: "Requieren aprobación",
            borderColor: "border-l-amber-500"
        },
        {
            icon: DollarSign,
            title: "Nómina Estimada",
            value: stats.estimatedPayroll ? `$${stats.estimatedPayroll.toFixed(2)}` : "$0.00",
            description: "Acumulado periodo actual",
            borderColor: "border-l-emerald-500"
        }
    ];

    return (
        <>
            {/* Mobile: Swipeable Carousel */}
            <div className="md:hidden">
                <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 scrollbar-hide">
                    {kpiData.map((kpi, index) => (
                        <div key={index} className="snap-start min-w-[280px] flex-shrink-0">
                            <KPICard
                                icon={kpi.icon}
                                title={kpi.title}
                                value={kpi.value}
                                description={kpi.description}
                                className={`border-l-4 ${kpi.borderColor} h-full`}
                            />
                        </div>
                    ))}
                </div>
                {/* Scroll indicator dots */}
                <div className="flex justify-center gap-1.5 mt-2">
                    {kpiData.map((_, index) => (
                        <div key={index} className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                    ))}
                </div>
            </div>

            {/* Desktop: Grid */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {kpiData.map((kpi, index) => (
                    <KPICard
                        key={index}
                        icon={kpi.icon}
                        title={kpi.title}
                        value={kpi.value}
                        description={kpi.description}
                        className={`border-l-4 ${kpi.borderColor}`}
                    />
                ))}
            </div>
        </>
    )
}
