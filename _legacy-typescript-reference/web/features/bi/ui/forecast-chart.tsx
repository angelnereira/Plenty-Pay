"use client"

import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts"
import { formatCents } from "@/lib/constants/plans"

interface ForecastPoint {
    date: string
    predicted: number
    lower: number
    upper: number
    historical?: boolean
    actual?: number
}

/** Mismo contrato que BILineChart — NO funciones cross-boundary RSC. */
export type ValueFormat = "currency" | "count" | "compact"

interface Props {
    data: ForecastPoint[]
    valueFormat?: ValueFormat
}

function formatValue(v: number, fmt: ValueFormat): string {
    switch (fmt) {
        case "currency": return formatCents(v * 100)
        case "compact":
            return v.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })
        case "count":
        default:
            return v.toLocaleString("en-US")
    }
}

export function ForecastChart({ data, valueFormat = "count" }: Props) {
    const chartData = data.map((p) => ({
        date: p.date.slice(5), // MM-DD
        actual: p.actual,
        predicted: p.predicted,
        bandLow: p.lower,
        bandHigh: p.upper,
        bandSize: p.upper - p.lower,
        historical: p.historical,
    }))

    // Encontrar el primer punto NO histórico para línea de referencia
    const firstForecastIdx = chartData.findIndex((p) => !p.historical)
    const refDate = firstForecastIdx > 0 ? chartData[firstForecastIdx]?.date : null

    return (
        <div className="w-full" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-slate-500 dark:text-slate-400" />
                    <YAxis tickFormatter={(v) => formatValue(Number(v), valueFormat)} tick={{ fontSize: 11 }} width={64} />
                    <Tooltip
                        contentStyle={{
                            background: "rgba(15, 23, 42, 0.92)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "white",
                        }}
                        formatter={(v) => formatValue(Number(v ?? 0), valueFormat)}
                    />
                    {/* Banda de confianza */}
                    <Area type="monotone" dataKey="bandHigh" stroke="none" fill="url(#bandFill)" />
                    <Area type="monotone" dataKey="bandLow" stroke="none" fill="#ffffff" fillOpacity={0} />
                    {/* Histórico (azul) y predicho (violeta) */}
                    <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2.5} dot={false} connectNulls={false} name="Real" />
                    <Line type="monotone" dataKey="predicted" stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="0" dot={false} name="Predicción" />
                    {refDate && (
                        <ReferenceLine x={refDate} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Hoy", position: "top", fill: "#64748b", fontSize: 10 }} />
                    )}
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    )
}
