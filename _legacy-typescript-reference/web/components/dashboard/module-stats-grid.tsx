'use client'

import {
  Package, AlertTriangle, ShoppingCart,
  Store, TrendingUp,
  Users, DollarSign,
  Truck, Clock,
  LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ModuleStats } from '@/actions/dashboard-actions'

interface StatItem {
  label: string
  value: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
}

interface ModuleStatCard {
  key: string
  title: string
  color: string
  stats: StatItem[]
}

const colorStyles: Record<string, { gradient: string; iconBg: string; iconColor: string; border: string }> = {
  emerald: {
    gradient: 'from-emerald-500/5 to-emerald-500/10 dark:from-emerald-500/10 dark:to-emerald-500/20',
    iconBg: 'bg-emerald-500',
    iconColor: 'text-white',
    border: 'border-emerald-100 dark:border-emerald-500/20',
  },
  blue: {
    gradient: 'from-blue-500/5 to-blue-500/10 dark:from-blue-500/10 dark:to-blue-500/20',
    iconBg: 'bg-blue-500',
    iconColor: 'text-white',
    border: 'border-blue-100 dark:border-blue-500/20',
  },
  amber: {
    gradient: 'from-amber-500/5 to-amber-500/10 dark:from-amber-500/10 dark:to-amber-500/20',
    iconBg: 'bg-amber-500',
    iconColor: 'text-white',
    border: 'border-amber-100 dark:border-amber-500/20',
  },
  rose: {
    gradient: 'from-rose-500/5 to-rose-500/10 dark:from-rose-500/10 dark:to-rose-500/20',
    iconBg: 'bg-rose-500',
    iconColor: 'text-white',
    border: 'border-rose-100 dark:border-rose-500/20',
  },
}

interface ModuleStatsGridProps {
  moduleStats: ModuleStats
}

export function ModuleStatsGrid({ moduleStats }: ModuleStatsGridProps) {
  const cards: ModuleStatCard[] = []

  if (moduleStats.pos) {
    cards.push({
      key: 'pos',
      title: 'POS Hoy',
      color: 'emerald',
      stats: [
        {
          label: 'Ventas',
          value: `$${moduleStats.pos.todaySales.toFixed(2)}`,
          icon: TrendingUp,
        },
        {
          label: 'Transacciones',
          value: moduleStats.pos.todayTransactions.toString(),
          icon: Store,
        },
      ]
    })
  }

  if (moduleStats.inventory) {
    cards.push({
      key: 'inventory',
      title: 'Inventario',
      color: 'blue',
      stats: [
        {
          label: 'Productos',
          value: moduleStats.inventory.totalProducts.toString(),
          icon: Package,
        },
        {
          label: 'Stock Bajo',
          value: moduleStats.inventory.lowStockCount.toString(),
          icon: AlertTriangle,
          trend: moduleStats.inventory.lowStockCount > 0 ? 'down' : 'neutral',
        },
        {
          label: 'Órdenes Abiertas',
          value: moduleStats.inventory.pendingOrders.toString(),
          icon: ShoppingCart,
        },
      ]
    })
  }

  if (moduleStats.payday) {
    cards.push({
      key: 'payday',
      title: 'Nómina',
      color: 'amber',
      stats: [
        {
          label: 'Empleados',
          value: moduleStats.payday.activeEmployees.toString(),
          icon: Users,
        },
        {
          label: 'Última Nómina',
          value: moduleStats.payday.lastPayrollTotal > 0
            ? `$${moduleStats.payday.lastPayrollTotal.toFixed(2)}`
            : 'Sin datos',
          icon: DollarSign,
        },
      ]
    })
  }

  if (moduleStats.logistics) {
    cards.push({
      key: 'logistics',
      title: 'Logística',
      color: 'rose',
      stats: [
        {
          label: 'En Tránsito',
          value: moduleStats.logistics.activeDeliveries.toString(),
          icon: Truck,
        },
        {
          label: 'Pendientes',
          value: moduleStats.logistics.pendingPickups.toString(),
          icon: Clock,
        },
      ]
    })
  }

  if (cards.length === 0) return null

  return (
    <div className={cn(
      "hidden md:grid gap-4",
      cards.length === 1 && "md:grid-cols-1",
      cards.length === 2 && "md:grid-cols-2",
      cards.length === 3 && "md:grid-cols-3",
      cards.length >= 4 && "md:grid-cols-4",
    )}>
      {cards.map((card) => {
        const styles = colorStyles[card.color]
        return (
          <div
            key={card.key}
            className={cn(
              'premium-card p-5 border bg-gradient-to-br',
              styles.gradient,
              styles.border
            )}
          >
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4">
              {card.title}
            </h3>
            <div className="space-y-3">
              {card.stats.map((stat) => {
                const StatIcon = stat.icon
                return (
                  <div key={stat.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatIcon className={cn(
                        'h-3.5 w-3.5',
                        stat.trend === 'down' ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'
                      )} />
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {stat.label}
                      </span>
                    </div>
                    <span className={cn(
                      'text-sm font-black',
                      stat.trend === 'down'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-900 dark:text-white'
                    )}>
                      {stat.value}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
