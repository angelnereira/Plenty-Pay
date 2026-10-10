"use client"

import {
  LayoutDashboard,
  Settings,
  Building2,
  Activity,
  FileText,
  ChevronLeft,
  ChevronRight,
  Package,
  Store,
  Bell,
  TrendingUp,
  Mail,
  LifeBuoy,
  Clock,
  ArrowUpCircle,
  Truck,
  ClipboardList,
  ShieldCheck,
  CreditCard,
  Briefcase,
  BarChart3
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@shared/ui/button"
import { useSidebar } from "./sidebar-provider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shared/ui/tooltip"
import { SidebarInfoCard } from "./sidebar-info-card"

interface SidebarItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
  badge?: string
  /** Required module flag - only show if this module is enabled */
  requiredModule?: 'facturacion' | 'inventory' | 'pos' | 'payday' | 'logistics' | 'creditos' | 'bi'
}

// All items are module-gated — no base module. Accounts can have 0 active modules.
// "creditos" se gatea por Client.creditosEnabled = true Y motorCreditTier
// asignado (default: ambos apagados). El cálculo lo hace dashboard/layout.tsx
// y nos pasa el booleano resuelto via prop. SUPER_ADMIN no opera el módulo
// desde su rol — activa el flag y elige tier por tenant en /admin/clients.
const defaultSidebarItems: SidebarItem[] = [
  { name: "Inicio",         href: "/dashboard",                icon: LayoutDashboard },
  { name: "Facturas",       href: "/dashboard/facturas",       icon: FileText,  requiredModule: "facturacion" },
  { name: "Punto de Venta", href: "/dashboard/pos",            icon: Store,     requiredModule: "pos" },
  { name: "Inventario",     href: "/dashboard/inventory",      icon: Package,   requiredModule: "inventory" },
  { name: "Nómina",         href: "/dashboard/payday",         icon: Clock,     requiredModule: "payday" },
  { name: "Envíos",         href: "/dashboard/logistics",      icon: Truck,     requiredModule: "logistics" },
  { name: "Créditos",       href: "/dashboard/creditos",       icon: CreditCard, requiredModule: "creditos" },
  { name: "BI",             href: "/dashboard/bi",             icon: BarChart3, requiredModule: "bi" },
  { name: "Configuración",  href: "/dashboard/configuracion",  icon: Settings },
]

if (process.env.NODE_ENV === 'development') {
  const names = defaultSidebarItems.map(item => item.name);
  const hrefs = defaultSidebarItems.map(item => item.href);
  const uniqueNames = new Set(names);
  const uniqueHrefs = new Set(hrefs);

  if (uniqueNames.size !== names.length) {
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    console.error('❌ CRITICAL: Duplicate sidebar items found:', duplicates);
  }

  if (uniqueHrefs.size !== hrefs.length) {
    const duplicates = hrefs.filter((href, index) => hrefs.indexOf(href) !== index);
    console.error('❌ CRITICAL: Duplicate sidebar hrefs found:', duplicates);
  }
}

const adminItems: SidebarItem[] = [
  { name: "Clientes", href: "/dashboard/admin/clients", icon: Building2, roles: ["SUPER_ADMIN"] },
  { name: "Aprobaciones", href: "/dashboard/admin/approvals", icon: ShieldCheck, roles: ["SUPER_ADMIN"] },
  { name: "Solicitudes Upgrade", href: "/dashboard/admin/upgrade-requests", icon: ArrowUpCircle, roles: ["SUPER_ADMIN"] },
  { name: "Créditos: panel avanzado", href: "/dashboard/admin/motor-access", icon: Briefcase, roles: ["SUPER_ADMIN"] },
  { name: "CRM Email", href: "/dashboard/admin/crm", icon: Mail, roles: ["SUPER_ADMIN"] },
  { name: "Notificaciones", href: "/dashboard/admin/notifications", icon: Bell, roles: ["SUPER_ADMIN"] },
  { name: "Soporte", href: "/dashboard/admin/support", icon: LifeBuoy, roles: ["SUPER_ADMIN"] },
  { name: "Monitoreo", href: "/dashboard/admin/monitoring", icon: Activity, roles: ["SUPER_ADMIN"] },
  { name: "Analítica", href: "/dashboard/admin/analytics", icon: TrendingUp, roles: ["SUPER_ADMIN"] },
  { name: "Auditoría", href: "/dashboard/admin/audit-log", icon: ClipboardList, roles: ["SUPER_ADMIN"] },
]

interface DashboardSidebarProps {
  userRole: string
  facturacionEnabled?: boolean
  inventoryEnabled?: boolean
  posEnabled?: boolean
  paydayEnabled?: boolean
  logisticsEnabled?: boolean
  creditosEnabled?: boolean
  /** BI Esencial activo (también si tiene biPro, que lo incluye). */
  biEnabled?: boolean
  /** Acceso opcional al panel avanzado del Motor (Schema Builder, intereses).
   *  No bloquea el módulo de Créditos visible — solo expande la UI. */
  motorPanelEnabled?: boolean
}

export function DashboardSidebar({
  userRole,
  facturacionEnabled = false,
  inventoryEnabled = false,
  posEnabled = false,
  paydayEnabled = false,
  logisticsEnabled = false,
  creditosEnabled = false,
  biEnabled = false,
  motorPanelEnabled = false,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const { isCollapsed, isMobileOpen, setMobileOpen, toggleSidebar, isHovered, setHovered } = useSidebar()
  void motorPanelEnabled // reservado para futuras decoraciones de "panel avanzado"

  // Filter items by role and active module flags.
  // No approvalStatus gate — modules are shown/hidden purely by their enabled flag.
  // SUPER_ADMIN always sees all items.
  const visibleItems = defaultSidebarItems.filter(item => {
    if (item.roles && !item.roles.includes(userRole)) return false

    if (item.requiredModule) {
      // Créditos: SUPER_ADMIN no opera el módulo (toggla el flag por tenant
      // en admin/clients). Tenants lo ven si creditosEnabled = true.
      if (item.requiredModule === 'creditos') {
        if (userRole === "SUPER_ADMIN") return false
        return creditosEnabled
      }
      // BI: mismo patrón — SUPER_ADMIN tiene su propio panel en
      // /dashboard/admin/analytics; los tenants ven el módulo si
      // biEnabled (o biProEnabled, ya consolidado en biEnabled prop).
      if (item.requiredModule === 'bi') {
        if (userRole === "SUPER_ADMIN") return false
        return biEnabled
      }
      if (userRole === "SUPER_ADMIN") return true
      if (item.requiredModule === 'facturacion' && !facturacionEnabled) return false
      if (item.requiredModule === 'inventory'   && !inventoryEnabled)   return false
      if (item.requiredModule === 'pos'         && !posEnabled)         return false
      if (item.requiredModule === 'payday'      && !paydayEnabled)      return false
      if (item.requiredModule === 'logistics'   && !logisticsEnabled)   return false
    }

    return true
  })

  const visibleAdminItems = adminItems.filter(item => {
    if (!item.roles) return true
    return item.roles.includes(userRole)
  })

  return (
    <TooltipProvider delayDuration={0}>
      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-all duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "fixed left-0 top-0 h-screen flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border/50 z-50 transition-all duration-300 ease-in-out hidden md:flex",
          // Width control - Expands on hover even if collapsed
          (isCollapsed && !isHovered) ? "w-[72px]" : "w-72",
          // Floating shadow when hovered and collapsed (expanded state over content)
          (isCollapsed && isHovered) && "shadow-2xl border-r-0"
        )}>

        {/* Logo Area */}
        <div className={cn(
          "h-16 flex-none flex items-center px-6 transition-all duration-300 border-b border-sidebar-border/50",
          (isCollapsed && !isHovered) ? "justify-center" : "justify-between"
        )}>
          {(!isCollapsed || isHovered) ? (
            <div className="flex items-center justify-start animate-in fade-in slide-in-from-left-4 duration-500">
              <span className="font-extrabold text-xl tracking-tighter uppercase text-sidebar-primary-foreground">PlentyPay</span>
            </div>
          ) : (
            <div className="bg-sidebar-primary/10 p-2 rounded-xl">
              <span className="font-black text-sidebar-primary">S</span>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide no-scrollbar py-4 px-3 space-y-6">
          {/* Main Navigation */}
          <nav className="space-y-1">
            {(!isCollapsed || isHovered) && (
              <p className="px-3 mb-2 text-[10px] font-bold text-sidebar-foreground/60 uppercase tracking-widest animate-in fade-in duration-300">
                Menú Principal
              </p>
            )}

            {visibleItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const showFull = !isCollapsed || isHovered

              const content = (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "bg-sidebar-primary/10 border-l-[3px] border-sidebar-primary text-sidebar-primary-foreground rounded-l-none"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    !showFull ? "justify-center" : "justify-start gap-4"
                  )}
                >
                  <Icon className={cn(
                    "h-5 w-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground"
                  )} />

                  {showFull && (
                    <span className="text-[13px] font-medium tracking-tight truncate animate-in fade-in slide-in-from-left-1 duration-200">
                      {item.name}
                    </span>
                  )}

                  {item.badge && showFull && (
                    <span className={cn(
                      "ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md",
                      isActive ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                    )}>{item.badge}</span>
                  )}
                </Link>
              )

              if (!showFull) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{content}</TooltipTrigger>
                    <TooltipContent side="right" className="bg-popover text-popover-foreground border-border text-xs">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                )
              }
              return <div key={item.href}>{content}</div>
            })}
          </nav>

          {/* Admin Section */}
          {visibleAdminItems.length > 0 && (
            <div className="space-y-1">
              {(!isCollapsed || isHovered) && (
                <p className="px-3 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest animate-in fade-in duration-300">
                  Administración
                </p>
              )}
              <div className="space-y-1">
                {visibleAdminItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                  const showFull = !isCollapsed || isHovered

                  const content = (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                        isActive
                          ? "bg-secondary/50 border-l-[3px] border-primary text-secondary-foreground rounded-l-none"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        !showFull ? "justify-center" : "justify-start gap-4"
                      )}
                    >
                      <Icon className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isActive ? "text-secondary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      {showFull && (
                        <span className="text-[13px] font-medium tracking-tight truncate animate-in fade-in slide-in-from-left-1 duration-200">{item.name}</span>
                      )}
                    </Link>
                  )

                  if (!showFull) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{content}</TooltipTrigger>
                        <TooltipContent side="right" className="bg-popover text-popover-foreground border-border text-xs">
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }
                  return <div key={item.href}>{content}</div>
                })}
              </div>
            </div>
          )}
        </div>

        {/* Info Cards Area (Only expanded) */}
        {(!isCollapsed || isHovered) && (
          <div className="flex-none px-3 pb-2 animate-in fade-in duration-500 delay-100">
            <SidebarInfoCard
              type="new"
              title="Nueva Versión"
              description="Sistema actualizado con diseño premium."
            />
          </div>
        )}

        {/* Footer Toggle — always visible at the bottom */}
        <div className="flex-none p-3 border-t border-sidebar-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={cn(
              "w-full transition-colors text-sidebar-foreground/60 hover:text-sidebar-primary-foreground hover:bg-sidebar-accent",
              (isCollapsed && !isHovered) ? "justify-center px-0" : "justify-start gap-3"
            )}
          >
            {(isCollapsed && !isHovered) ? (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider">Colapsar</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
