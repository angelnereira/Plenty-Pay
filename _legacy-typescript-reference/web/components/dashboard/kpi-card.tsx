'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  description?: string;
  className?: string;
}

export function KPICard({ title, value, icon: Icon, trend, description, className }: KPICardProps) {
  return (
    <div
      className={cn(
        'premium-card p-4 sm:p-6 group relative h-full flex flex-col',
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] truncate">
            {title}
          </h3>
          {description && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {description}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-white/[0.05] dark:border dark:border-white/[0.1] flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-500">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-auto">
        <div className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter truncate" title={String(value)}>
          {value}
        </div>

        {trend && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className={cn(
              "p-1 rounded-lg",
              trend.isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
            )}>
              {trend.isPositive ? '↑' : '↓'}
            </div>
            <p className={cn(
              'text-[10px] font-black uppercase tracking-tight',
              trend.isPositive ? 'text-emerald-500' : 'text-rose-500'
            )}>
              {trend.value} <span className="text-slate-400 dark:text-slate-500 opacity-60">vs mes anterior</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

