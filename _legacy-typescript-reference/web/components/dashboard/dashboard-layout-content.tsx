"use client"

import { useSidebar } from "./sidebar-provider"
import { cn } from "@/lib/utils"
import { GlobalBackButton } from "./global-back-button"

export function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const { isCollapsed } = useSidebar()

    return (
        <main
            className={cn(
                "flex-1 px-4 sm:px-6 lg:px-8 py-4 md:py-6 pt-24 md:pt-28 transition-all duration-300 ease-in-out min-h-screen",
                isCollapsed ? "md:ml-[88px]" : "md:ml-72"
            )}
        >
            <div className="w-full max-w-7xl mx-auto animate-in fade-in duration-500">
                <GlobalBackButton />
                {children}
            </div>
        </main>
    )
}
