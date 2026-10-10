/**
 * Helpers de período de tiempo para los dashboards BI.
 *
 * Las páginas server-side leen `?period=...&from=...&to=...` de
 * searchParams. Si no viene nada se asume MTD.
 */

export type PeriodKey = "today" | "7d" | "30d" | "mtd" | "ytd" | "custom"

export interface ResolvedPeriod {
    key: PeriodKey
    from: string // ISO YYYY-MM-DD
    to: string   // ISO YYYY-MM-DD
    label: string
    /** Período inmediatamente anterior, mismo tamaño — para deltas. */
    previous: { from: string; to: string } | null
}

const ISO = (d: Date): string => d.toISOString().slice(0, 10)

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfYear(d: Date): Date {
    return new Date(d.getFullYear(), 0, 1)
}

function shiftDays(d: Date, days: number): Date {
    const next = new Date(d)
    next.setDate(d.getDate() + days)
    return next
}

function diffDays(from: string, to: string): number {
    const a = new Date(from + "T00:00:00")
    const b = new Date(to + "T00:00:00")
    return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
}

export function resolvePeriod(
    searchParams: { period?: string; from?: string; to?: string } | undefined,
    now: Date = new Date(),
): ResolvedPeriod {
    const today = ISO(now)
    const key = (searchParams?.period as PeriodKey | undefined) ?? "mtd"

    let from: string
    let to: string
    let label: string

    switch (key) {
        case "today":
            from = today
            to = today
            label = "Hoy"
            break
        case "7d":
            from = ISO(shiftDays(now, -6))
            to = today
            label = "Últimos 7 días"
            break
        case "30d":
            from = ISO(shiftDays(now, -29))
            to = today
            label = "Últimos 30 días"
            break
        case "ytd":
            from = ISO(startOfYear(now))
            to = today
            label = "Año en curso"
            break
        case "custom": {
            const isISO = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
            const f = isISO(searchParams?.from) ? searchParams!.from! : ISO(startOfMonth(now))
            const t = isISO(searchParams?.to)   ? searchParams!.to!   : today
            from = f
            to = t
            label = `${f} → ${t}`
            break
        }
        case "mtd":
        default:
            from = ISO(startOfMonth(now))
            to = today
            label = "Mes en curso"
            break
    }

    // Período anterior del mismo tamaño
    const days = diffDays(from, to)
    const prevFromDate = shiftDays(new Date(from + "T00:00:00"), -days)
    const prevToDate = shiftDays(new Date(from + "T00:00:00"), -1)
    const previous = days > 0 ? { from: ISO(prevFromDate), to: ISO(prevToDate) } : null

    return { key: key === "custom" ? "custom" : key, from, to, label, previous }
}

export function buildPeriodHref(base: string, key: PeriodKey, custom?: { from: string; to: string }): string {
    const params = new URLSearchParams()
    params.set("period", key)
    if (key === "custom" && custom) {
        params.set("from", custom.from)
        params.set("to", custom.to)
    }
    return `${base}?${params.toString()}`
}

export const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
    { key: "today", label: "Hoy" },
    { key: "7d",    label: "7 días" },
    { key: "30d",   label: "30 días" },
    { key: "mtd",   label: "Mes" },
    { key: "ytd",   label: "Año" },
]
