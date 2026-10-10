'use client';

import { Badge } from '@shared/ui/badge';
import { CheckCircle2, XCircle, Clock, AlertCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Estados posibles de un documento HKA
 */
export type HKAStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'EMITTING'
  | 'EMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'ERROR'
  | 'PENDING';

interface StatusBadgeProps {
  status: HKAStatus | string;
  className?: string;
  showIcon?: boolean;
}

/**
 * Componente Atom: StatusBadge
 *
 * Muestra el estado de un documento HKA con color y texto apropiado.
 * Sigue las convenciones de color de estado:
 * - Verde: Aprobado/Exitoso
 * - Rojo: Rechazado/Error
 * - Amarillo: Pendiente/En proceso
 * - Gris: Borrador/Cancelado
 */
export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium',
        config.className,
        className
      )}
    >
      {showIcon && <config.Icon className="h-3.5 w-3.5" />}
      <span>{config.label}</span>
    </Badge>
  );
}

/**
 * Configuración de estados
 */
function getStatusConfig(status: HKAStatus | string): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  Icon: any;
} {
  const normalizedStatus = status.toUpperCase();

  switch (normalizedStatus) {
    case 'APPROVED':
    case 'EMITTED':
      return {
        label: 'Aprobado',
        variant: 'default',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200',
        Icon: CheckCircle2,
      };

    case 'REJECTED':
    case 'ERROR':
      return {
        label: 'Rechazado',
        variant: 'destructive',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200',
        Icon: XCircle,
      };

    case 'PENDING':
    case 'QUEUED':
      return {
        label: 'Pendiente',
        variant: 'secondary',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200',
        Icon: Clock,
      };

    case 'EMITTING':
      return {
        label: 'Emitiendo',
        variant: 'secondary',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
        Icon: Send,
      };

    case 'DRAFT':
      return {
        label: 'Borrador',
        variant: 'outline',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300',
        Icon: AlertCircle,
      };

    case 'CANCELLED':
      return {
        label: 'Anulado',
        variant: 'outline',
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300',
        Icon: XCircle,
      };

    default:
      return {
        label: status,
        variant: 'outline',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        Icon: AlertCircle,
      };
  }
}

/**
 * Hook para obtener el color del estado (útil para gráficas y otros componentes)
 */
export function useStatusColor(status: HKAStatus | string): string {
  const config = getStatusConfig(status);
  return config.className;
}
