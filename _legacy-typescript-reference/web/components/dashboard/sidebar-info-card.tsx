"use client"

import { Lightbulb, Sparkles, X } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface SidebarInfoCardProps {
    type?: 'tip' | 'new' | 'alert'
    title: string
    description: string
    onDismiss?: () => void
}

export function SidebarInfoCard({ type = 'tip', title, description, onDismiss }: SidebarInfoCardProps) {
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) return null

    const handleDismiss = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsVisible(false)
        onDismiss?.()
    }

    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl p-4 mb-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2",
            type === 'tip' && "bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20",
            type === 'new' && "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20",
            type === 'alert' && "bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20"
        )}>
            {/* dismiss button */}
            <button
                onClick={handleDismiss}
                className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5"
            >
                <X size={14} />
            </button>

            <div className="flex gap-3">
                <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
                    type === 'tip' && "bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300",
                    type === 'new' && "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
                    type === 'alert' && "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300"
                )}>
                    {type === 'tip' && <Lightbulb size={16} />}
                    {type === 'new' && <Sparkles size={16} />}
                    {type === 'alert' && <Lightbulb size={16} />}
                </div>

                <div className="flex-1 pr-2">
                    <h4 className={cn(
                        "text-[11px] font-black uppercase tracking-widest mb-1",
                        type === 'tip' && "text-violet-700 dark:text-violet-300",
                        type === 'new' && "text-emerald-700 dark:text-emerald-300",
                        type === 'alert' && "text-amber-700 dark:text-amber-300"
                    )}>
                        {title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    )
}
