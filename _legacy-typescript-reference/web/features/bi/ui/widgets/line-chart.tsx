"use client"

import { ResponsiveContainer, LineChart as RC, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { formatCents } from "@/lib/constants/plans"

export interface LinePoint {
    label: string
    value: number
}

/**
 * Formato del eje Y / tooltip.
 *
 * IMPORTANTE: NO recibimos un `valueFormatter` como prop, porque ese sería
 * una función — y las funciones no son serializables a través del límite
 * Server → Client de React Server Components. Pasar una función desde un
 * Server Component crashea con "Functions cannot be passed directly to
 * Client Components" (digest 3726653047 que veníamos diagnosticando).
 *
 * En su lugar:
 *  - "currency" → formatCents(v * 100) — el caller pasa el valor en unidades
 *    decimales (no centavos) y la función multiplica.
 *  - "count"    → toLocaleString plain.
 *  - "compact"  → notación abreviada (1.2k, 3M).
 */
export type ValueFormat = "currency" | "count" | "compact"

interface BILineChartProps {
    data: LinePoint[]
    color?: string
    height?: number
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

export function BILineChart({
    data,
    color = "#7c3aed",
    height = 280,
    valueFormat = "count",
}: BILineChartProps) {
    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <RC data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        className="text-slate-500 dark:text-slate-400"
                    />
                    <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => formatValue(Number(v), valueFormat)}
                        className="text-slate-500 dark:text-slate-400"
                        width={64}
                    />
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
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                    />
                </RC>
            </ResponsiveContainer>
        </div>
    )
}
