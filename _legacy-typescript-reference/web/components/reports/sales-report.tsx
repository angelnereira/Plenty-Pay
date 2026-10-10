"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts"

interface SalesReportProps {
  data: Array<{
    month: string
    ventas: number
    facturas: number
  }>
}

export function SalesReport({ data }: SalesReportProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
        <div className="mb-6">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-[350px] flex items-end justify-between gap-2 px-4">
          {[40, 70, 45, 90, 65, 80].map((h, i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-t-lg w-full" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-8">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-[250px] bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700" />
        </div>
      </div>
    )
  }

  const isDark = resolvedTheme === 'dark'

  // Colors dinámicos según el tema
  const colors = {
    grid: isDark ? '#374151' : '#f0f0f0',
    axis: isDark ? '#9ca3af' : '#6b7280',
    tooltipBg: isDark ? '#1f2937' : '#fff',
    tooltipBorder: isDark ? '#374151' : '#e5e7eb',
    barVentas: isDark ? '#6366f1' : '#4F46E5',
    lineFacturas: isDark ? '#34d399' : '#10B981',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ventas Mensuales</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Últimos 6 meses</p>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          <XAxis
            dataKey="month"
            className="text-xs"
            tick={{ fill: colors.axis }}
          />
          <YAxis
            className="text-xs"
            tick={{ fill: colors.axis }}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: '0.5rem',
              color: isDark ? '#f3f4f6' : '#111827',
            }}
            formatter={(value: any) => [`$${value.toFixed(2)}`, '']}
          />
          <Legend />
          <Bar
            dataKey="ventas"
            fill={colors.barVentas}
            name="Ventas ($)"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Gráfico de facturas */}
      <div className="mt-8">
        <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">Facturas Emitidas</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="month"
              className="text-xs"
              tick={{ fill: colors.axis }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: colors.axis }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`,
                borderRadius: '0.5rem',
                color: isDark ? '#f3f4f6' : '#111827',
              }}
            />
            <Line
              type="monotone"
              dataKey="facturas"
              stroke={colors.lineFacturas}
              strokeWidth={3}
              dot={{ fill: colors.lineFacturas, r: 5 }}
              name="Facturas"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
