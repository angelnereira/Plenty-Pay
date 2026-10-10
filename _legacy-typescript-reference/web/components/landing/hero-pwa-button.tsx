"use client"

import { useEffect, useState } from "react"
import { Download, Smartphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { ConfettiCelebration } from "./confetti-celebration"
import { trackEvent } from "@/lib/analytics"

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function HeroPWAButton() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
    const [isInstalled, setIsInstalled] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [showCelebration, setShowCelebration] = useState(false)

    useEffect(() => {
        // Track button view
        trackEvent('pwa_button_viewed')

        // Verificar si ya está instalado
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
            return
        }

        const handler = (e: Event) => {
            e.preventDefault()
            setInstallPrompt(e as BeforeInstallPromptEvent)
            console.log('✅ PWA: Install prompt disponible')
            trackEvent('pwa_install_prompted')
        }

        window.addEventListener('beforeinstallprompt', handler)

        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            console.log('🎉 PWA: App instalada exitosamente')
            setIsInstalled(true)
            setInstallPrompt(null)
            setShowCelebration(true)
            trackEvent('pwa_install_completed')
        })

        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
        }
    }, [])

    const handleInstall = async () => {
        console.log('🔍 PWA: Intentando instalar...', { hasPrompt: !!installPrompt })

        // Track button click
        trackEvent('pwa_button_clicked', {
            has_prompt: !!installPrompt
        })

        if (!installPrompt) {
            console.warn('⚠️ PWA: No hay prompt disponible.')

            // Verificar si la app ya está instalada
            if (window.matchMedia('(display-mode: standalone)').matches) {
                console.log('✅ PWA: App ya instalada, redirigiendo...')
                window.location.href = '/dashboard'
                return
            }

            // No mostrar alert - el navegador tiene su propio botón de instalación
            console.log('ℹ️ PWA: El navegador mostrará su propio botón si está disponible')
            return
        }

        setIsLoading(true)
        try {
            console.log('🚀 PWA: Mostrando prompt de instalación...')
            await installPrompt.prompt()
            const { outcome } = await installPrompt.userChoice

            console.log(`📋 PWA: Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`)

            if (outcome === 'accepted') {
                trackEvent('pwa_install_accepted')
                setInstallPrompt(null)
            } else {
                trackEvent('pwa_install_rejected')
            }
        } catch (error) {
            console.error('❌ PWA: Error al instalar:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Si ya está instalado, mostrar botón para ir a dashboard
    if (isInstalled) {
        return (
            <div className="flex flex-col items-center gap-3">
                <button
                    onClick={() => window.location.href = '/dashboard'}
                    className={cn(
                        "w-full sm:w-auto group flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300",
                        "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 backdrop-blur-md",
                        "hover:border-emerald-400/50 transform hover:-translate-y-1",
                        "shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
                    )}
                >
                    <Smartphone className="h-5 w-5" />
                    <span>App Instalada ✓</span>
                </button>
                <ConfettiCelebration
                    show={showCelebration}
                    onComplete={() => setShowCelebration(false)}
                />
            </div>
        )
    }

    // Si no hay prompt disponible, ocultar botón
    // El navegador mostrará su propio botón de instalación si es posible
    if (!installPrompt) {
        console.log('ℹ️ PWA: Botón oculto - prompt no disponible')
        return null
    }

    return (
        <>
            <button
                onClick={handleInstall}
                disabled={isLoading}
                className={cn(
                    "w-full sm:w-auto group relative overflow-hidden",
                    "flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-lg font-semibold",
                    "transition-all duration-300",
                    "bg-gradient-to-r from-violet-500/20 via-fuchsia-500/20 to-indigo-500/20",
                    "border border-violet-400/30 hover:border-violet-400/50",
                    "text-white backdrop-blur-md",
                    "hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.5)]",
                    "transform hover:-translate-y-1 hover:scale-105",
                    isLoading && "opacity-50 cursor-wait"
                )}
            >
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Subtle shimmer effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* Content - SOLO icono y texto */}
                <div className="relative flex items-center gap-2">
                    <Download className={cn(
                        "h-5 w-5 transition-transform duration-300",
                        "group-hover:scale-110"
                    )} />
                    <span>
                        {isLoading ? "Instalando..." : "Instalar App"}
                    </span>
                </div>
            </button>

            {/* Celebration animation */}
            <ConfettiCelebration
                show={showCelebration}
                onComplete={() => setShowCelebration(false)}
            />
        </>
    )
}
