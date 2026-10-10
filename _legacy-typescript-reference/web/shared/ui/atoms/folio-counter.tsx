'use client';

import { Badge } from '@shared/ui/badge';
import { AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FolioCounterProps {
  available: number;
  total?: number;
  threshold?: number;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Componente Atom: FolioCounter
 *
 * Muestra el contador de folios disponibles con alertas visuales:
 * - Rojo: folios < threshold (por defecto 50)
 * - Amarillo: folios entre threshold y threshold*2
 * - Verde: folios >= threshold*2
 */
export function FolioCounter({
  available,
  total,
  threshold = 50,
  className,
  showIcon = true,
  size = 'md',
}: FolioCounterProps) {
  const status = getFolioStatus(available, threshold);
  const sizeClasses = getSizeClasses(size);

  return (
    <Badge
      variant={status.variant}
      className={cn(
        'flex items-center gap-2',
        status.className,
        sizeClasses,
        className
      )}
    >
      {showIcon && <status.Icon className={cn(
        size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
      )} />}
      <div className="flex flex-col items-start">
        <span className={cn(
          'font-bold tabular-nums',
          size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm'
        )}>
          {available.toLocaleString()}
        </span>
        <span className={cn(
          'font-normal opacity-90',
          size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xs' : 'text-[11px]'
        )}>
          {total ? `de ${total.toLocaleString()}` : 'disponibles'}
        </span>
      </div>
    </Badge>
  );
}

/**
 * Determina el estado de los folios basado en el umbral
 */
function getFolioStatus(available: number, threshold: number): {
  variant: 'default' | 'secondary' | 'destructive';
  className: string;
  Icon: any;
  message: string;
} {
  if (available < threshold) {
    return {
      variant: 'destructive',
      className: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-400 border-red-300',
      Icon: AlertTriangle,
      message: '¡Crítico! Recarga folios urgentemente',
    };
  }

  if (available < threshold * 2) {
    return {
      variant: 'secondary',
      className: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300',
      Icon: Package,
      message: 'Considera recargar folios pronto',
    };
  }

  return {
    variant: 'default',
    className: 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-400 border-green-300',
    Icon: CheckCircle,
    message: 'Folios suficientes',
  };
}

/**
 * Clases de tamaño
 */
function getSizeClasses(size: 'sm' | 'md' | 'lg'): string {
  switch (size) {
    case 'sm':
      return 'px-2 py-1';
    case 'lg':
      return 'px-4 py-2.5';
    case 'md':
    default:
      return 'px-3 py-1.5';
  }
}

/**
 * Variante compacta del FolioCounter (solo número)
 */
export function FolioCounterCompact({
  available,
  threshold = 50,
  className,
}: Pick<FolioCounterProps, 'available' | 'threshold' | 'className'>) {
  const status = getFolioStatus(available, threshold);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <status.Icon className={cn('h-4 w-4', getIconColor(available, threshold))} />
      <span className={cn('text-sm font-semibold tabular-nums', getTextColor(available, threshold))}>
        {available.toLocaleString()}
      </span>
    </div>
  );
}

function getIconColor(available: number, threshold: number): string {
  if (available < threshold) return 'text-red-600 dark:text-red-400';
  if (available < threshold * 2) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

function getTextColor(available: number, threshold: number): string {
  if (available < threshold) return 'text-red-700 dark:text-red-300';
  if (available < threshold * 2) return 'text-yellow-700 dark:text-yellow-300';
  return 'text-green-700 dark:text-green-300';
}

/**
 * Hook para obtener el mensaje de alerta de folios
 */
export function useFolioAlert(available: number, threshold: number = 50): {
  shouldAlert: boolean;
  message: string;
  severity: 'critical' | 'warning' | 'ok';
} {
  if (available < threshold) {
    return {
      shouldAlert: true,
      message: `Solo tienes ${available} folios. ¡Recarga urgentemente!`,
      severity: 'critical',
    };
  }

  if (available < threshold * 2) {
    return {
      shouldAlert: true,
      message: `Tienes ${available} folios. Considera recargar pronto.`,
      severity: 'warning',
    };
  }

  return {
    shouldAlert: false,
    message: `Tienes ${available} folios disponibles.`,
    severity: 'ok',
  };
}
