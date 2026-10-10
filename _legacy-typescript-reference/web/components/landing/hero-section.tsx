"use client"

import Link from "next/link"
import { ArrowRight, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { HeroPWAButton } from "./hero-pwa-button"

export function HeroSection() {
    return (
        <section className="relative min-h-screen flex flex-col justify-center px-4 pt-32 pb-20 overflow-hidden">
            {/* Background Image - Full Coverage */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/assets/landing/hero_saas_dashboard_3d.png"
                    fill
                    alt="PlentyPay Dashboard Preview"
                    className="object-cover object-center"
                    priority
                    quality={90}
                />
                {/* Dark gradient overlay for text readability */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-800/80 dark:from-slate-950/95 dark:via-slate-950/90 dark:to-slate-900/80" />
                {/* Additional gradient from bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-transparent to-transparent dark:from-slate-950/95 dark:via-transparent" />
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]" />
                {/* Decorative brand watermark — opaque, non-interactive */}
                <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden"
                    aria-hidden
                >
                    <Image
                        src="/plentypay-logo-light.png"
                        alt=""
                        width={900}
                        height={900}
                        aria-hidden
                        className="select-none object-contain translate-x-[18%] -rotate-12 opacity-[0.055] mix-blend-screen"
                        priority={false}
                    />
                </div>
                {/* Soft color aura to counter the dashboard grayness */}
                <div className="pointer-events-none absolute -top-24 -left-24 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[140px]" aria-hidden />
                <div className="pointer-events-none absolute -bottom-32 right-0 h-[480px] w-[480px] rounded-full bg-indigo-600/20 blur-[140px]" aria-hidden />
            </div>

            {/* Content Container */}
            <div className="relative z-10 max-w-7xl mx-auto w-full">
                <div className="max-w-4xl">
                    {/* Main Headline */}
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-8 leading-[1.05] tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        <span className="block text-white drop-shadow-2xl">Solución Empresarial</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 drop-shadow-lg">
                            Todo en Uno.
                        </span>
                    </h1>

                    {/* Subheadline */}
                    {/* Subheadline */}
                    <div className="mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300 max-w-3xl">
                        <p className="text-lg sm:text-xl md:text-2xl text-slate-300 leading-relaxed drop-shadow-md font-medium mb-4">
                            La plataforma que unifica:
                        </p>
                        <div className="flex flex-wrap gap-2 mb-6">
                            {[
                                'Facturación Electrónica',
                                'Inventario',
                                'Punto de Venta',
                                'Logística',
                                'Control de Personal Biométrico'
                            ].map((module) => (
                                <span
                                    key={module}
                                    className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-white/[0.08] hover:bg-white/[0.12] transition-colors text-white border border-white/[0.12] shadow-sm backdrop-blur-sm cursor-default"
                                >
                                    {module}
                                </span>
                            ))}
                        </div>
                        <p className="text-lg sm:text-xl md:text-2xl text-slate-300 leading-relaxed drop-shadow-md font-medium">
                            Activa los módulos que tu empresa necesita y crece sin migrar.
                        </p>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-start gap-4 w-full sm:w-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
                        <HeroPWAButton />
                    </div>
                </div>
            </div>
        </section>
    )
}

