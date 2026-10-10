"use client"

import { useState } from "react"
import {
    Sparkles,
    CreditCard,
    Users,
    MonitorSmartphone,
    Package,
    Store,
    FileText,
    Check,
    ArrowRight,
    Zap,
    Crown,
    Building2,
    ChevronRight,
    Mail,
    Truck,
    Code,
    AlertTriangle,
    MessageCircle,
    Headphones,
    Wrench,
    GraduationCap,
    BarChart3,
    Brain,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { UpgradeRequestModal } from "./upgrade-request-modal"
import {
    PLAN_CONFIG,
    ADDON_CATALOG,
    ADDON_ORDER,
    EXTRA_PRICING_CENTS,
    computeMonthlyTotalCents,
    formatCents,
    isAddonActive,
    isAddonIncludedInPlan,
    getAddonMonthlyCents,
    type PlanType,
    type AddonId,
} from "@/lib/constants/plans"
import type { MotorCreditTier } from "@prisma/client"

const PLAN_VISUAL: Record<PlanType, { icon: typeof Zap; color: string; bgColor: string; borderColor: string }> = {
    START:      { icon: Zap,       color: "text-blue-500",    bgColor: "bg-blue-500/10",    borderColor: "border-blue-500/30" },
    BUSINESS:   { icon: Crown,     color: "text-violet-500",  bgColor: "bg-violet-500/10",  borderColor: "border-violet-500/30" },
    ENTERPRISE: { icon: Building2, color: "text-fuchsia-500", bgColor: "bg-fuchsia-500/10", borderColor: "border-fuchsia-500/30" },
}

const ADDON_VISUAL: Record<AddonId, { icon: typeof Package; color: string; bgColor: string }> = {
    payday:         { icon: Users,        color: "text-blue-500",    bgColor: "bg-blue-500/10" },
    logistics:      { icon: Truck,        color: "text-amber-500",   bgColor: "bg-amber-500/10" },
    creditos:       { icon: CreditCard,   color: "text-rose-500",    bgColor: "bg-rose-500/10" },
    apiAccess:      { icon: Code,         color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    multiBranch:    { icon: Building2,    color: "text-indigo-500",  bgColor: "bg-indigo-500/10" },
    whatsapp:       { icon: MessageCircle,color: "text-green-600",   bgColor: "bg-green-600/10" },
    premiumSupport: { icon: Headphones,   color: "text-fuchsia-500", bgColor: "bg-fuchsia-500/10" },
    bi:             { icon: BarChart3,    color: "text-violet-500",  bgColor: "bg-violet-500/10" },
    biPro:          { icon: Brain,        color: "text-purple-500",  bgColor: "bg-purple-500/10" },
}

interface ClientData {
    id: string
    name: string
    planType: string
    maxUsers: number
    maxPosStations: number
    maxBranches: number
    extraBranches: number
    facturacionEnabled: boolean
    inventoryEnabled: boolean
    posEnabled: boolean
    paydayEnabled: boolean
    logisticsEnabled: boolean
    creditosEnabled: boolean
    motorCreditTier: MotorCreditTier | null
    apiAccessEnabled: boolean
    whatsappEnabled: boolean
    premiumSupportEnabled: boolean
    createdAt: Date
}

interface SubscriptionDetailsProps {
    client: ClientData
    currentUsers: number
    activePosStations: number
    paydayEmployeeCount: number
    currentMonthInvoiceCount: number
}

export function SubscriptionDetails({
    client,
    currentUsers,
    activePosStations,
    paydayEmployeeCount,
    currentMonthInvoiceCount,
}: SubscriptionDetailsProps) {
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
    const [upgradeType, setUpgradeType] = useState<"plan" | "addon" | "limits">("plan")

    const planType = (PLAN_CONFIG[client.planType as PlanType] ? (client.planType as PlanType) : "START") as PlanType
    const planSpec = PLAN_CONFIG[planType]
    const visual = PLAN_VISUAL[planType]
    const PlanIcon = visual.icon

    // Cap de facturas y porcentaje de uso (soft cap).
    const invoiceCap = planSpec.monthlyInvoiceCap
    const invoicePct = invoiceCap > 0 ? Math.min(1, currentMonthInvoiceCount / invoiceCap) : 0
    const invoiceWarn80 = invoicePct >= 0.8 && invoicePct < 1
    const invoiceWarn100 = invoicePct >= 1

    // Capacidad extra contratada sobre el plan.
    const extraUsers = Math.max(0, client.maxUsers - planSpec.maxUsers)
    const extraPosStations = Math.max(0, client.maxPosStations - planSpec.maxPosStations)

    // Total mensual via single source of truth.
    const totalCents = computeMonthlyTotalCents(client, {
        paydayEmployeeCount,
        extraUsers,
        extraPosStations,
        extraInvoiceBlocks: 0,
    })

    const baseCents = planSpec.priceCents
    const hasExtras = totalCents > baseCents

    const openUpgradeModal = (type: "plan" | "addon" | "limits") => {
        setUpgradeType(type)
        setUpgradeModalOpen(true)
    }

    return (
        <>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
                            <CreditCard className="h-8 w-8 text-violet-500" />
                            Mi Suscripción
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Gestiona tu plan, módulos y límites
                        </p>
                    </div>

                    <button
                        onClick={() => openUpgradeModal("plan")}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl font-bold shadow-lg shadow-violet-600/20 hover:shadow-xl hover:scale-[1.02] transition-all"
                    >
                        <Sparkles className="h-5 w-5" />
                        Hacer Upgrade
                    </button>
                </div>

                {/* Soft-cap warning de facturas */}
                {invoiceWarn80 && !invoiceWarn100 && (
                    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <h4 className="font-bold text-amber-900 dark:text-amber-100">Cerca del límite mensual</h4>
                            <p className="text-sm text-amber-800 dark:text-amber-200 mt-0.5">
                                Has emitido {currentMonthInvoiceCount} de {invoiceCap} facturas incluidas en tu plan {planSpec.label}.
                                {" "}Cada bloque adicional de {planSpec.overageBlock.facturas} facturas cuesta {formatCents(planSpec.overageBlock.priceCents)}.
                            </p>
                        </div>
                    </div>
                )}
                {invoiceWarn100 && (
                    <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-700 dark:bg-red-900/20">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <h4 className="font-bold text-red-900 dark:text-red-100">Superaste el límite mensual</h4>
                            <p className="text-sm text-red-800 dark:text-red-200 mt-0.5">
                                Llevas {currentMonthInvoiceCount} de {invoiceCap} facturas incluidas. Sigues emitiendo, pero el sobreconsumo se factura aparte ({formatCents(planSpec.overageBlock.priceCents)} por bloque de {planSpec.overageBlock.facturas}). Considera subir de plan.
                            </p>
                        </div>
                    </div>
                )}

                {/* Current Plan Card */}
                <div className={cn(
                    "relative overflow-hidden rounded-2xl border-2 p-6 md:p-8",
                    "bg-white dark:bg-slate-900",
                    visual.borderColor
                )}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 rounded-full blur-3xl" />

                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className={cn("p-4 rounded-2xl", visual.bgColor)}>
                                    <PlanIcon className={cn("h-10 w-10", visual.color)} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                                            Plan {planSpec.label}
                                        </h2>
                                        <span className="px-3 py-1 text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                            Activo
                                        </span>
                                    </div>
                                    <p className="text-gray-500 dark:text-gray-400">
                                        Cliente: {client.name}
                                    </p>
                                </div>
                            </div>

                            <div className="text-left md:text-right">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-gray-900 dark:text-white">
                                        {formatCents(totalCents)}
                                    </span>
                                    <span className="text-gray-500">/mes</span>
                                </div>
                                {hasExtras && (
                                    <p className="text-sm text-gray-400 mt-1">
                                        Plan base: {formatCents(baseCents)} + extras
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Plan Features */}
                        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                Incluido en tu Plan
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {planSpec.bullets.map((feature) => (
                                    <div key={feature} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                        <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Usage Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Users */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-xl">
                                <Users className="h-6 w-6 text-blue-500" />
                            </div>
                            <span className="text-2xl font-black text-gray-900 dark:text-white">
                                {currentUsers}/{client.maxUsers}
                            </span>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Usuarios</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {Math.max(0, client.maxUsers - currentUsers)} disponibles
                        </p>
                        <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (currentUsers / Math.max(1, client.maxUsers)) * 100)}%` }}
                            />
                        </div>
                        {extraUsers > 0 && (
                            <p className="text-xs text-blue-500 mt-2">
                                +{extraUsers} extras ({formatCents(extraUsers * EXTRA_PRICING_CENTS.user)}/mes)
                            </p>
                        )}
                    </div>

                    {/* POS Stations */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-green-500/10 rounded-xl">
                                <MonitorSmartphone className="h-6 w-6 text-green-500" />
                            </div>
                            <span className="text-2xl font-black text-gray-900 dark:text-white">
                                {activePosStations}/{client.maxPosStations}
                            </span>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Cajas POS Activas</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {Math.max(0, client.maxPosStations - activePosStations)} disponibles
                        </p>
                        <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, (activePosStations / Math.max(1, client.maxPosStations)) * 100)}%` }}
                            />
                        </div>
                        {extraPosStations > 0 && (
                            <p className="text-xs text-green-500 mt-2">
                                +{extraPosStations} extras ({formatCents(extraPosStations * EXTRA_PRICING_CENTS.posStation)}/mes)
                            </p>
                        )}
                    </div>

                    {/* Invoices */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-3 bg-violet-500/10 rounded-xl">
                                <FileText className="h-6 w-6 text-violet-500" />
                            </div>
                            <span className="text-2xl font-black text-gray-900 dark:text-white">
                                {currentMonthInvoiceCount}/{invoiceCap}
                            </span>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Facturas este mes</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {invoiceWarn100 ? "Sobreconsumo activo" : `${Math.max(0, invoiceCap - currentMonthInvoiceCount)} disponibles`}
                        </p>
                        <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-all",
                                    invoiceWarn100 ? "bg-red-500" : invoiceWarn80 ? "bg-amber-500" : "bg-violet-500"
                                )}
                                style={{ width: `${invoicePct * 100}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Modules Section */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Módulos Adicionales</h2>
                        <button
                            onClick={() => openUpgradeModal("addon")}
                            className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline flex items-center gap-1"
                        >
                            Agregar módulo <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ADDON_ORDER.map((addonId) => {
                            const spec = ADDON_CATALOG[addonId]
                            const v = ADDON_VISUAL[addonId]
                            const Icon = v.icon
                            const includedByPlan = isAddonIncludedInPlan(planType, addonId)
                            const active = includedByPlan || isAddonActive(client, addonId)
                            const ctxForCard = { paydayEmployeeCount }
                            const monthlyCents = active && !includedByPlan
                                ? getAddonMonthlyCents(client, addonId, ctxForCard)
                                : 0

                            // Subtítulo dinámico para creditos / payday / multiBranch.
                            let subtitle: string | null = null
                            if (addonId === "creditos" && active && client.motorCreditTier && spec.pricing.kind === "tiered") {
                                const tier = spec.pricing.tiers[client.motorCreditTier]
                                subtitle = `${tier.label} · ${formatCents(tier.priceCents)}/mes`
                            } else if (addonId === "payday" && active && spec.pricing.kind === "dynamic") {
                                const total = spec.pricing.baseCents + paydayEmployeeCount * spec.pricing.perEmployeeCents
                                subtitle = `${formatCents(spec.pricing.baseCents)} base + ${formatCents(spec.pricing.perEmployeeCents)} × ${paydayEmployeeCount} empleados = ${formatCents(total)}/mes`
                            } else if (addonId === "multiBranch") {
                                if (active && spec.pricing.kind === "perUnit") {
                                    subtitle = `${client.extraBranches} sucursal(es) extra · ${formatCents(client.extraBranches * spec.pricing.unitPriceCents)}/mes`
                                } else if (spec.pricing.kind === "perUnit") {
                                    subtitle = `${formatCents(spec.pricing.unitPriceCents)}/sucursal/mes`
                                }
                            } else if (spec.pricing.kind === "fixed") {
                                subtitle = `${formatCents(spec.pricing.priceCents)}/mes`
                            }

                            return (
                                <div
                                    key={addonId}
                                    className={cn(
                                        "relative rounded-2xl border p-6 transition-all",
                                        active
                                            ? "bg-white dark:bg-slate-900 border-green-500/30 shadow-lg"
                                            : "bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-gray-700 opacity-75"
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={cn("p-3 rounded-xl", v.bgColor)}>
                                            <Icon className={cn("h-6 w-6", v.color)} />
                                        </div>
                                        {includedByPlan ? (
                                            <span className="px-3 py-1 text-xs font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full flex items-center gap-1">
                                                <Sparkles className="h-3 w-3" /> Incluido en tu plan
                                            </span>
                                        ) : active ? (
                                            <span className="px-3 py-1 text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex items-center gap-1">
                                                <Check className="h-3 w-3" /> Activo
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full">
                                                No contratado
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">{spec.label}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{spec.description}</p>

                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {subtitle}
                                        </span>
                                        {!active && !includedByPlan && (
                                            <button
                                                onClick={() => openUpgradeModal("addon")}
                                                className="text-sm text-violet-600 dark:text-violet-400 font-medium hover:underline"
                                            >
                                                Contratar
                                            </button>
                                        )}
                                        {active && !includedByPlan && monthlyCents > 0 && (
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                {formatCents(monthlyCents)}/mes
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Upgrade Limits */}
                <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-1">¿Necesitas más capacidad?</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Añade usuarios adicionales por {formatCents(EXTRA_PRICING_CENTS.user)}/mes o cajas POS por {formatCents(EXTRA_PRICING_CENTS.posStation)}/mes
                            </p>
                        </div>
                        <button
                            onClick={() => openUpgradeModal("limits")}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:border-violet-500 transition-colors"
                        >
                            Ampliar límites <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Servicios adicionales (cobro único, fuera del catálogo recurrente) */}
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-1">Servicios adicionales</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Cobro único, gestionado a medida. Te enviamos cotización tras hablar contigo.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <a
                            href="mailto:ventas@plentypay.com?subject=Cotizaci%C3%B3n%20Onboarding%20pagado"
                            className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-violet-500 transition-colors"
                        >
                            <GraduationCap className="h-5 w-5 text-violet-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">Onboarding pagado</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Capacitación, migración de datos y arranque guiado
                                </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                        </a>
                        <a
                            href="mailto:ventas@plentypay.com?subject=Cotizaci%C3%B3n%20Hardware%20POS"
                            className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-violet-500 transition-colors"
                        >
                            <Wrench className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">Hardware POS</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Impresoras, lectores de código, cajón monedero
                                </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                        </a>
                    </div>
                </div>

                {/* Contact Support */}
                <div className="text-center py-6 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-gray-500 dark:text-gray-400 mb-3">
                        ¿Necesitas ayuda o tienes preguntas sobre tu suscripción?
                    </p>
                    <a
                        href="mailto:soporte@plentypay.com"
                        className="inline-flex items-center gap-2 text-violet-600 dark:text-violet-400 font-medium hover:underline"
                    >
                        <Mail className="h-4 w-4" />
                        Contactar Soporte
                    </a>
                </div>
            </div>

            {/* Upgrade Modal */}
            <UpgradeRequestModal
                isOpen={upgradeModalOpen}
                onClose={() => setUpgradeModalOpen(false)}
                type={upgradeType}
                client={client}
                paydayEmployeeCount={paydayEmployeeCount}
            />
        </>
    )
}
