"use client"

import Link from "next/link"

interface ErrorDisplayProps {
    title: string
    message: string
    actionLabel?: string
    actionHref?: string
    showSupport?: boolean
    error?: Error | { message: string }
}

export function ErrorDisplay({
    title,
    message,
    actionLabel = "Recargar",
    actionHref = "/dashboard",
    showSupport = true,
    error
}: ErrorDisplayProps) {
    const handleSupportClick = () => {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('plentypay-support-trigger', {
                detail: {
                    triggerSupport: true,
                    error: error instanceof Error ? error : { message: error?.message || title }
                }
            }));
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-100 dark:border-red-800 max-w-md">
                <h2 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-2">
                    {title}
                </h2>
                <p className="text-red-600 dark:text-red-300 mb-4">
                    {message}
                </p>
                <div className="flex gap-3 justify-center">
                    <Link
                        href={actionHref}
                        className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                    >
                        {actionLabel}
                    </Link>
                    {showSupport && (
                        <button
                            onClick={handleSupportClick}
                            className="inline-flex items-center px-4 py-2 bg-white dark:bg-zinc-800 text-red-600 border border-red-200 dark:border-red-900 rounded-lg font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                            Pedir Soporte
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
