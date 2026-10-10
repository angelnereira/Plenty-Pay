"use client"

import { LogOut, Settings, User } from "lucide-react"
import { signOut } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { NotificationsCenter } from "./notifications-center"
import { ThemeToggle } from "@/components/theme-toggle"
import { InstallPWAButton } from "@/components/install-pwa"
import { useSidebar } from "./sidebar-provider"
import { cn } from "@/lib/utils"
import { SystemStatusIndicator } from "./system-status"
import { clearSessionPersisted } from "@/lib/session-persister"

interface FolioBalance {
  available: number;
  total: number;
  used: number;
}

interface DashboardHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    role?: string
  }
  initialFolios?: FolioBalance
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const router = useRouter()
  const { isCollapsed } = useSidebar()

  const handleSignOut = async () => {
    try {
      await clearSessionPersisted()
    } catch (e) {
      console.error("Error clearing session background flag:", e)
    }
    await signOut({ redirect: false })
    window.location.href = '/auth/signin'
  }

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-40 h-16 transition-all duration-300 ease-in-out border-b border-border/40",
        // Glassmorphism — login-style
        "bg-background/80 dark:bg-white/[0.04] backdrop-blur-2xl dark:border-white/[0.08]",
        // Desktop positioning based on sidebar state
        "left-0",
        isCollapsed ? "md:left-[72px]" : "md:left-72"
      )}
    >
      <div className="h-full px-4 flex items-center justify-between max-w-7xl mx-auto">
        {/* Left Section (Logo or Title for mobile context if needed) */}
        <div className="flex items-center gap-4">
          {/* Mobile Only Logo/Mark */}
          <div className="md:hidden font-black text-xl tracking-tighter text-foreground uppercase">
            PlentyPay
          </div>

          <SystemStatusIndicator />
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden lg:block">
            <InstallPWAButton />
          </div>

          <ThemeToggle />
          <NotificationsCenter />

          <div className="h-8 w-px bg-border hidden sm:block mx-1" />

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-1.5 hover:bg-muted rounded-full transition-all group"
            >
              <div className="flex items-center justify-center h-8 w-8 bg-primary text-primary-foreground rounded-full shadow-md shadow-primary/10 group-hover:scale-105 transition-transform">
                <User className="h-4 w-4" />
              </div>
              <div className="hidden md:block text-left mr-2">
                <p className="text-sm font-semibold text-foreground leading-none">
                  {user.name?.split(' ')[0] || "Usuario"}
                </p>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
                  {user.role || "CLIENT"}
                </p>
              </div>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-card dark:bg-slate-900/90 dark:backdrop-blur-2xl rounded-lg shadow-lg border border-border dark:border-white/[0.1] p-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-3 py-2 border-b border-border/50 mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      router.push('/dashboard/configuracion')
                      setShowUserMenu(false)
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Configuración</span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
