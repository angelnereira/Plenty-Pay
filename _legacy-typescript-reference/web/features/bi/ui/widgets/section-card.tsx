import { cn } from "@/lib/utils"

interface SectionCardProps {
    title: string
    subtitle?: string
    action?: React.ReactNode
    children: React.ReactNode
    className?: string
}

export function SectionCard({ title, subtitle, action, children, className }: SectionCardProps) {
    return (
        <div className={cn(
            "rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5",
            className,
        )}>
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
                    {subtitle && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
                    )}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
            {children}
        </div>
    )
}
