'use client'

import Link from 'next/link'
import {
  FileText, Plus, Upload, Store, TrendingUp,
  Package, ArrowUpDown, ShoppingCart,
  Users, Calendar,
  Truck, Clock,
  LucideIcon, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAction {
  label: string
  description: string
  icon: LucideIcon
  href: string
  action?: string
  featured?: boolean
}

interface ModuleSection {
  key: string
  label: string
  icon: LucideIcon
  color: string
  actions: QuickAction[]
}

const MODULE_DEFINITIONS: Record<string, Omit<ModuleSection, 'key'>> = {
  invoicing: {
    label: 'Facturación',
    icon: FileText,
    color: 'violet',
    actions: [
      { label: 'Nueva Factura', description: 'Crear factura electrónica', icon: Plus, href: '#', action: 'openGenerator', featured: true },
      { label: 'Importar', description: 'Desde Excel o XML', icon: Upload, href: '#', action: 'importFile' },
      { label: 'Ver Facturas', description: 'Historial completo', icon: FileText, href: '/dashboard/facturas' },
    ]
  },
  pos: {
    label: 'Punto de Venta',
    icon: Store,
    color: 'emerald',
    actions: [
      { label: 'Abrir Caja', description: 'Iniciar sesión de caja', icon: Store, href: '/dashboard/pos', featured: true },
      { label: 'Ventas del Día', description: 'Resumen de ventas', icon: TrendingUp, href: '/dashboard/pos/ventas-dia' },
    ]
  },
  inventory: {
    label: 'Inventario',
    icon: Package,
    color: 'blue',
    actions: [
      { label: 'Productos', description: 'Catálogo completo', icon: Package, href: '/dashboard/inventory/productos', featured: true },
      { label: 'Movimientos', description: 'Entradas y salidas', icon: ArrowUpDown, href: '/dashboard/inventory/movimientos' },
      { label: 'Órdenes', description: 'Órdenes de compra', icon: ShoppingCart, href: '/dashboard/inventory/ordenes-compra' },
    ]
  },
  payday: {
    label: 'Nómina',
    icon: Clock,
    color: 'amber',
    actions: [
      { label: 'Empleados', description: 'Gestión de personal', icon: Users, href: '/dashboard/payday/employees', featured: true },
      { label: 'Horarios', description: 'Turnos y asistencia', icon: Calendar, href: '/dashboard/payday/schedule' },
    ]
  },
  logistics: {
    label: 'Envíos',
    icon: Truck,
    color: 'rose',
    actions: [
      { label: 'Envíos Activos', description: 'Seguimiento en tiempo real', icon: Truck, href: '/dashboard/logistics', featured: true },
    ]
  },
}

const colorMap: Record<string, {
  bg: string
  text: string
  border: string
  headerBg: string
  actionHover: string
  featuredBg: string
  featuredBorder: string
  dot: string
}> = {
  violet: {
    bg: 'bg-violet-500/10 dark:bg-violet-500/20',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200/50 dark:border-violet-500/20',
    headerBg: 'bg-gradient-to-r from-violet-50 to-violet-100/50 dark:from-violet-500/10 dark:to-violet-500/5',
    actionHover: 'hover:bg-violet-50/80 dark:hover:bg-violet-500/10',
    featuredBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
    featuredBorder: 'ring-violet-500/20',
    dot: 'bg-violet-500',
  },
  emerald: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200/50 dark:border-emerald-500/20',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-500/5',
    actionHover: 'hover:bg-emerald-50/80 dark:hover:bg-emerald-500/10',
    featuredBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    featuredBorder: 'ring-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200/50 dark:border-blue-500/20',
    headerBg: 'bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-500/10 dark:to-blue-500/5',
    actionHover: 'hover:bg-blue-50/80 dark:hover:bg-blue-500/10',
    featuredBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    featuredBorder: 'ring-blue-500/20',
    dot: 'bg-blue-500',
  },
  amber: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200/50 dark:border-amber-500/20',
    headerBg: 'bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-500/10 dark:to-amber-500/5',
    actionHover: 'hover:bg-amber-50/80 dark:hover:bg-amber-500/10',
    featuredBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
    featuredBorder: 'ring-amber-500/20',
    dot: 'bg-amber-500',
  },
  rose: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200/50 dark:border-rose-500/20',
    headerBg: 'bg-gradient-to-r from-rose-50 to-rose-100/50 dark:from-rose-500/10 dark:to-rose-500/5',
    actionHover: 'hover:bg-rose-50/80 dark:hover:bg-rose-500/10',
    featuredBg: 'bg-gradient-to-br from-rose-500 to-rose-600',
    featuredBorder: 'ring-rose-500/20',
    dot: 'bg-rose-500',
  },
}

interface ModuleQuickAccessProps {
  inventoryEnabled?: boolean
  posEnabled?: boolean
  paydayEnabled?: boolean
  logisticsEnabled?: boolean
  onAction?: (action: string) => void
}

export function ModuleQuickAccess({
  inventoryEnabled,
  posEnabled,
  paydayEnabled,
  logisticsEnabled,
  onAction,
}: ModuleQuickAccessProps) {
  const activeModules: ModuleSection[] = [
    { key: 'invoicing', ...MODULE_DEFINITIONS.invoicing },
  ]

  if (posEnabled) activeModules.push({ key: 'pos', ...MODULE_DEFINITIONS.pos })
  if (inventoryEnabled) activeModules.push({ key: 'inventory', ...MODULE_DEFINITIONS.inventory })
  if (paydayEnabled) activeModules.push({ key: 'payday', ...MODULE_DEFINITIONS.payday })
  if (logisticsEnabled) activeModules.push({ key: 'logistics', ...MODULE_DEFINITIONS.logistics })

  return (
    <div className={cn(
      "grid gap-4",
      activeModules.length === 1 && "grid-cols-1",
      activeModules.length === 2 && "grid-cols-1 md:grid-cols-2",
      activeModules.length === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      activeModules.length >= 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
    )}>
      {activeModules.map((mod) => {
          const colors = colorMap[mod.color]
          const ModIcon = mod.icon
          return (
            <div
              key={mod.key}
              className={cn(
                'rounded-xl border overflow-hidden transition-all duration-200',
                'bg-white dark:bg-white/[0.03]',
                colors.border,
                'hover:shadow-md'
              )}
            >
              {/* Module Header */}
              <div className={cn('flex items-center gap-2.5 px-4 py-3', colors.headerBg)}>
                <div className={cn('p-1.5 rounded-lg', colors.bg)}>
                  <ModIcon className={cn('h-4 w-4', colors.text)} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                  {mod.label}
                </span>
                <div className={cn('ml-auto h-1.5 w-1.5 rounded-full animate-pulse', colors.dot)} />
              </div>

              {/* Action Links */}
              <div className="p-2 pb-3">
                {mod.actions.map((action) => {
                  const ActionIcon = action.icon
                  const isAction = !!action.action

                  const content = (
                    <>
                      <div className={cn(
                        'shrink-0 p-2 rounded-lg transition-all duration-200',
                        action.featured
                          ? cn(colors.featuredBg, 'shadow-sm')
                          : colors.bg
                      )}>
                        <ActionIcon className={cn(
                          'h-4 w-4',
                          action.featured ? 'text-white' : colors.text
                        )} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          'text-xs font-bold block truncate',
                          'text-slate-700 dark:text-slate-200',
                          'group-hover:text-slate-900 dark:group-hover:text-white'
                        )}>
                          {action.label}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
                          {action.description}
                        </span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-400 transition-all duration-200 group-hover:translate-x-0.5" />
                    </>
                  )

                  if (isAction) {
                    return (
                      <button
                        key={action.label}
                        onClick={() => onAction?.(action.action!)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200',
                          colors.actionHover,
                          'group'
                        )}
                      >
                        {content}
                      </button>
                    )
                  }

                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                        colors.actionHover,
                        'group'
                      )}
                    >
                      {content}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
      })}
    </div>
  )
}
