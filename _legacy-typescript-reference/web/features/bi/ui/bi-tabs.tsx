"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
    { href: "/dashboard/bi",            label: "Resumen" },
    { href: "/dashboard/bi/ventas",     label: "Ventas" },
    { href: "/dashboard/bi/productos",  label: "Productos" },
    { href: "/dashboard/bi/clientes",   label: "Clientes" },
    { href: "/dashboard/bi/inventario", label: "Inventario" },
    { href: "/dashboard/bi/creditos",   label: "Créditos" },
    { href: "/dashboard/bi/alerts",     label: "Alertas" },
    { href: "/dashboard/bi/dashboards", label: "Mis tableros", pro: true },
    { href: "/dashboard/bi/explore",    label: "Explorador",   pro: true },
    { href: "/dashboard/bi/forecast",   label: "Predicción",   pro: true },
    { href: "/dashboard/bi/segments",   label: "Segmentos",    pro: true },
    { href: "/dashboard/bi/campaigns",  label: "Campañas",     pro: true },
    { href: "/dashboard/bi/anomalies",  label: "Anomalías",    pro: true },
    { href: "/dashboard/bi/cohorts",    label: "Cohortes",     pro: true },
    { href: "/dashboard/bi/basket",     label: "Canasta",      pro: true },
    { href: "/dashboard/bi/ask",        label: "Pregúntale",   pro: true },
]

export function BITabs() {
    const pathname = usePathname()
    return (
        <nav className="border-b border-slate-200 dark:border-white/10 -mx-4 px-4 mb-6 overflow-x-auto">
            <ul className="flex items-center gap-1 min-w-max">
                {TABS.map((t) => {
                    const active = pathname === t.href || (t.href !== "/dashboard/bi" && pathname.startsWith(t.href))
                    return (
                        <li key={t.href}>
                            <Link
                                href={t.href}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors",
                                    active
                                        ? "border-violet-600 text-slate-900 dark:text-white"
                                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
                                )}
                            >
                                {t.label}
                                {t.pro && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white">
                                        Pro
                                    </span>
                                )}
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
