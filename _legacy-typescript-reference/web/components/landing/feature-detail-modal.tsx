"use client"

import { X, Check, Zap, Package, CreditCard, Shield, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/shared/ui/dialog"
import { ScrollArea } from "@/shared/ui/scroll-area"

export interface FeatureDetailData {
    icon: typeof Zap
    title: string
    subtitle: string
    description: string
    color: string
    bgColor: string
    keyBenefits: string[]
    technicalSpecs: {
        label: string
        value: string
    }[]
    useCases: {
        title: string
        description: string
    }[]
    pricingInfo?: {
        plan: string
        description: string
    }
}

interface FeatureDetailModalProps {
    feature: FeatureDetailData | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function FeatureDetailModal({ feature, open, onOpenChange }: FeatureDetailModalProps) {
    if (!feature) return null

    const Icon = feature.icon

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-white dark:bg-slate-900/90 dark:backdrop-blur-2xl border-slate-200 dark:border-white/[0.1]">
                <ScrollArea className="h-[90vh]">
                    {/* Header with gradient */}
                    <div className={cn(
                        "relative px-8 py-12 border-b border-slate-200 dark:border-slate-800",
                        feature.bgColor
                    )}>
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5" />

                        <div className="relative z-10">
                            <div className={cn(
                                "w-16 h-16 rounded-2xl mb-6 flex items-center justify-center",
                                "bg-white dark:bg-slate-900 shadow-lg"
                            )}>
                                <Icon className={cn("h-8 w-8", feature.color)} />
                            </div>

                            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
                                {feature.title}
                            </h2>
                            <p className="text-xl text-slate-600 dark:text-slate-400">
                                {feature.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-8 py-8 space-y-10">
                        {/* Description */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                                Descripción
                            </h3>
                            <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
                                {feature.description}
                            </p>
                        </div>

                        {/* Key Benefits */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                                Beneficios Clave
                            </h3>
                            <div className="grid gap-3">
                                {feature.keyBenefits.map((benefit, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <div className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                                            feature.bgColor
                                        )}>
                                            <Check className={cn("h-4 w-4", feature.color)} />
                                        </div>
                                        <p className="text-slate-700 dark:text-slate-300">
                                            {benefit}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Technical Specs */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                                Especificaciones Técnicas
                            </h3>
                            <div className="grid gap-3">
                                {feature.technicalSpecs.map((spec, index) => (
                                    <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                                            {spec.label}
                                        </span>
                                        <span className={cn("font-mono text-sm", feature.color)}>
                                            {spec.value}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Use Cases */}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4">
                                Casos de Uso
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {feature.useCases.map((useCase, index) => (
                                    <div key={index} className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700">
                                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">
                                            {useCase.title}
                                        </h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {useCase.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pricing Info (if applicable) */}
                        {feature.pricingInfo && (
                            <div className={cn(
                                "p-6 rounded-2xl border-2",
                                feature.bgColor,
                                "border-current"
                            )}>
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                        "bg-white dark:bg-slate-900"
                                    )}>
                                        <span className={cn("text-xl font-black", feature.color)}>
                                            {feature.pricingInfo.plan.charAt(0)}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="font-black text-slate-900 dark:text-white mb-1">
                                            Plan {feature.pricingInfo.plan}
                                        </h4>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {feature.pricingInfo.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer CTA */}
                    <div className="px-8 py-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                ¿Listo para potenciar tu negocio?
                            </p>
                            <button
                                onClick={() => {
                                    onOpenChange(false)
                                    // Scroll to pricing section or open signup
                                    const pricingSection = document.getElementById('planes')
                                    if (pricingSection) {
                                        pricingSection.scrollIntoView({ behavior: 'smooth' })
                                    }
                                }}
                                className={cn(
                                    "px-6 py-3 rounded-xl font-bold uppercase text-sm tracking-wide",
                                    "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white",
                                    "hover:shadow-lg hover:shadow-violet-500/50 transition-all duration-300",
                                    "hover:scale-105"
                                )}
                            >
                                Ver Planes
                            </button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
