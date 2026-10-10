/**
 * BADGE DE ESTADO DE FACTURA
 * 
 * Componente que muestra el estado de una factura con
 * colores y animaciones en tiempo real.
 * 
 * Estados:
 * - DRAFT: Borrador (gris)
 * - QUEUED: En cola (azul)
 * - PROCESSING: Procesando (amarillo + animación)
 * - CERTIFIED: Certificado (verde)
 * - REJECTED: Rechazado (rojo)
 * - CANCELLED: Anulado (gris oscuro)
 * - ERROR: Error (rojo oscuro)
 */

import { cn } from '@/lib/utils';
import { InvoiceStatus } from '@prisma/client';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  FileX,
  Loader2,
  FileText
} from 'lucide-react';

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  DRAFT: {
    label: 'Borrador',
    color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
    icon: FileText,
    description: 'Factura en borrador',
    animated: false,
  },
  QUEUED: {
    label: 'En Cola',
    color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700',
    icon: Clock,
    description: 'En cola para procesamiento',
    animated: false,
  },
  PROCESSING: {
    label: 'Procesando',
    color: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 animate-pulse',
    icon: Loader2,
    description: 'Procesando en HKA',
    animated: true,
  },
  CERTIFIED: {
    label: 'Certificado',
    color: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700',
    icon: CheckCircle2,
    description: 'Certificado por DGI',
    animated: false,
  },
  REJECTED: {
    label: 'Rechazado',
    color: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700',
    icon: XCircle,
    description: 'Rechazado por HKA',
    animated: false,
  },
  CANCELLED: {
    label: 'Anulado',
    color: 'bg-gray-200 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 border-gray-400 dark:border-gray-600',
    icon: FileX,
    description: 'Factura anulada',
    animated: false,
  },
  ERROR: {
    label: 'Error',
    color: 'bg-red-200 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-400 dark:border-red-700',
    icon: AlertCircle,
    description: 'Error en procesamiento',
    animated: false,
  },
} as const;

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5',
} as const;

const iconSizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
} as const;

export function InvoiceStatusBadge({
  status,
  className,
  showIcon = true,
  size = 'md',
}: InvoiceStatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium transition-all',
        config.color,
        sizeClasses[size],
        className
      )}
      title={config.description}
    >
      {showIcon && (
        <Icon
          className={cn(
            iconSizeClasses[size],
            config.animated && 'animate-spin'
          )}
        />
      )}
      <span>{config.label}</span>
    </div>
  );
}

/**
 * Badge con tooltip expandido
 */
export function InvoiceStatusBadgeWithTooltip({
  status,
  className,
  size = 'md',
  hkaMessage,
  certifiedAt,
}: InvoiceStatusBadgeProps & {
  hkaMessage?: string | null;
  certifiedAt?: Date | null;
}) {
  const config = statusConfig[status as keyof typeof statusConfig];

  return (
    <div className="group relative inline-block">
      <InvoiceStatusBadge
        status={status}
        className={className}
        size={size}
      />

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg border border-gray-700">
          <div className="font-semibold">{config.label}</div>
          <div className="text-gray-300 dark:text-gray-400">{config.description}</div>

          {hkaMessage && (
            <div className="mt-1 text-gray-400 dark:text-gray-500 max-w-xs whitespace-normal">
              {hkaMessage}
            </div>
          )}

          {certifiedAt && status === 'CERTIFIED' && (
            <div className="mt-1 text-gray-400 dark:text-gray-500">
              {new Date(certifiedAt).toLocaleString('es-PA')}
            </div>
          )}

          {/* Flecha del tooltip */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Badge compacto (solo icono)
 */
export function InvoiceStatusIcon({
  status,
  className,
  size = 'md',
}: InvoiceStatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        config.color,
        iconSizeClasses[size],
        className
      )}
      title={config.label}
    >
      <Icon
        className={cn(
          'w-full h-full p-0.5',
          config.animated && 'animate-spin'
        )}
      />
    </div>
  );
}

/**
 * Lista de estados disponibles (para filtros, etc)
 */
export const INVOICE_STATUSES = Object.keys(statusConfig) as InvoiceStatus[];

/**
 * Obtener configuración de un estado
 */
export function getStatusConfig(status: InvoiceStatus) {
  return statusConfig[status as keyof typeof statusConfig];
}

