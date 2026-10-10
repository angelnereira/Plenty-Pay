"use client"

import { useEffect } from "react"
import { cn } from "@/lib/utils"

interface ConfettiCelebrationProps {
    show: boolean
    onComplete: () => void
}

export function ConfettiCelebration({ show, onComplete }: ConfettiCelebrationProps) {
    useEffect(() => {
        if (show) {
            // Auto-dismiss after 3 seconds
            const timer = setTimeout(onComplete, 3000)
            return () => clearTimeout(timer)
        }
    }, [show, onComplete])

    if (!show) return null

    // Confetti colors - vibrant and celebratory
    const colors = [
        '#8b5cf6', // violet
        '#ec4899', // fuchsia
        '#6366f1', // indigo
        '#10b981', // emerald
        '#f59e0b', // amber
        '#ef4444', // red
        '#06b6d4', // cyan
    ]

    // Generate confetti particles
    const particles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.5}s`,
        duration: `${2 + Math.random() * 2}s`,
        color: colors[i % colors.length],
        rotation: Math.random() * 360,
    }))

    return (
        <div
            className="fixed inset-0 z-[100] pointer-events-none"
            aria-live="polite"
            aria-atomic="true"
        >
            {/* Confetti particles */}
            <div className="absolute inset-0 overflow-hidden">
                {particles.map((particle) => (
                    <div
                        key={particle.id}
                        className="absolute w-3 h-3 -top-10 animate-confetti-fall"
                        style={{
                            left: particle.left,
                            animationDelay: particle.delay,
                            animationDuration: particle.duration,
                            backgroundColor: particle.color,
                            transform: `rotate(${particle.rotation}deg)`,
                        }}
                    />
                ))}
            </div>

            {/* Success message overlay */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className={cn(
                    "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl",
                    "p-8 rounded-2xl shadow-2xl border border-violet-200 dark:border-violet-500/20",
                    "animate-in zoom-in-95 duration-500",
                    "text-center max-w-sm"
                )}>
                    {/* Celebration emoji */}
                    <div className="text-7xl mb-4 animate-bounce">
                        🎉
                    </div>

                    {/* Title */}
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tight">
                        ¡App Instalada!
                    </h3>

                    {/* Subtitle */}
                    <p className="text-lg text-slate-600 dark:text-slate-400 mb-4">
                        Disfruta acceso rápido y trabaja offline
                    </p>

                    {/* Benefits */}
                    <div className="flex items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                            <span>⚡</span>
                            <span>Más rápido</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span>📱</span>
                            <span>En tu pantalla</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span>🔔</span>
                            <span>Notificaciones</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS for confetti animation */}
            <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }

        .animate-confetti-fall {
          animation: confetti-fall linear forwards;
        }

        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .animate-confetti-fall {
            animation-duration: 0.01ms !important;
          }
          
          .animate-bounce {
            animation: none;
          }
        }
      `}</style>
        </div>
    )
}
