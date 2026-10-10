'use client';

import Link from 'next/link';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'info';
  badge?: string;
  onClick?: () => void;
  compact?: boolean;
}

const variantStyles = {
  primary: {
    border: 'border-blue-100 dark:border-blue-900/50 hover:border-blue-500/50',
    bg: 'bg-gradient-to-br from-white to-blue-50/50 dark:from-white/[0.06] dark:backdrop-blur-2xl dark:to-blue-900/20 hover:from-blue-50 hover:to-blue-100/50 dark:hover:from-white/[0.05] dark:hover:to-blue-900/40',
    iconBg: 'bg-blue-600 dark:bg-blue-500',
    iconColor: 'text-white',
    badgeBg: 'bg-blue-600',
  },
  secondary: {
    border: 'border-slate-100 dark:border-white/[0.08] hover:border-purple-500/50',
    bg: 'bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl hover:bg-slate-50 dark:hover:bg-white/[0.05]',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
    badgeBg: 'bg-purple-600',
  },
  success: {
    border: 'border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-500/50',
    bg: 'bg-gradient-to-br from-white to-emerald-50/50 dark:from-white/[0.06] dark:backdrop-blur-2xl dark:to-emerald-900/20 hover:from-emerald-50 hover:to-emerald-100/50 dark:hover:from-white/[0.05] dark:hover:to-emerald-900/40',
    iconBg: 'bg-emerald-600 dark:bg-emerald-500',
    iconColor: 'text-white',
    badgeBg: 'bg-emerald-600',
  },
  warning: {
    border: 'border-slate-100 dark:border-white/[0.08] hover:border-amber-500/50',
    bg: 'bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl hover:bg-slate-50 dark:hover:bg-white/[0.05]',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-500',
    badgeBg: 'bg-amber-600',
  },
  info: {
    border: 'border-slate-100 dark:border-white/[0.08] hover:border-blue-500/50',
    bg: 'bg-white dark:bg-white/[0.06] dark:backdrop-blur-2xl hover:bg-slate-50 dark:hover:bg-white/[0.05]',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
    badgeBg: 'bg-blue-600',
  },
};

export function ActionCard({
  title,
  description,
  icon: Icon,
  href,
  variant = 'primary',
  badge,
  onClick,
  compact = false,
}: ActionCardProps) {
  const styles = variantStyles[variant];

  const content = (
    <div className={cn("flex items-start relative z-10", compact ? "gap-3" : "gap-4 sm:gap-6")}>
      {/* Icon */}
      <div className={cn(
        'rounded-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-sm flex-shrink-0',
        compact ? 'p-2.5' : 'p-4',
        styles.iconBg
      )}>
        <Icon className={cn(compact ? 'h-5 w-5' : 'h-6 w-6', styles.iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col pt-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={cn(
            "font-black dark:text-white text-slate-900 uppercase tracking-widest group-hover:text-primary transition-colors",
            compact ? "text-[11px]" : "text-[13px]"
          )}>
            {title}
          </h4>
          {badge && (
            <span className={cn(
              'px-2 py-0.5 rounded-lg text-[9px] font-black text-white uppercase tracking-tighter',
              styles.badgeBg
            )}>
              {badge}
            </span>
          )}
        </div>
        <p className={cn(
          "text-slate-500 dark:text-slate-400 leading-relaxed font-medium",
          compact ? "text-[10px]" : "text-xs"
        )}>
          {description}
        </p>
      </div>

      {/* Arrow */}
      {!compact && (
        <div className="hidden sm:flex self-center items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.05] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-500">
          <ArrowRight className={cn('h-4 w-4', styles.iconColor)} />
        </div>
      )}
    </div>
  );

  const baseStyles = cn(
    'group block w-full text-left rounded-xl border transition-all duration-500 shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:shadow-primary/10 relative overflow-hidden',
    compact ? 'p-4' : 'p-6 sm:p-8',
    styles.border,
    styles.bg
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={baseStyles}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
        {content}
      </button>
    );
  }

  return (
    <Link href={href} className={baseStyles}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
      {content}
    </Link>
  );
}

