'use client';

/**
 * Banner de Modo Contingencia
 *
 * Se muestra cuando el sistema está en modo contingencia (tipoEmision=02/04).
 * Indica el tiempo transcurrido y el tiempo restante de la ventana de 72 horas.
 * Permite desactivar el modo contingencia.
 */

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, X, Clock, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContingencyState {
  activa: boolean;
  inicio: string | null;
  motivo: string | null;
  tipo: '02' | '04' | null;
}

const MAX_HOURS = 72;

function formatHorasMinutos(ms: number): string {
  const totalMinutes = Math.floor(ms / 1000 / 60);
  const horas = Math.floor(totalMinutes / 60);
  const minutos = totalMinutes % 60;
  return `${horas}h ${minutos}min`;
}

export function ContingencyBanner() {
  const [state, setState] = useState<ContingencyState | null>(null);
  const [elapsed, setElapsed] = useState<number>(0); // ms desde inicio
  const [deactivating, setDeactivating] = useState(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/hka/contingency');
      if (!res.ok) return;
      const data: ContingencyState = await res.json();
      setState(data);
    } catch {
      // silently ignore — no queremos romper el UI si el API falla
    }
  }, []);

  // Cargar estado inicial
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Actualizar elapsed cada minuto
  useEffect(() => {
    if (!state?.activa || !state.inicio) return;

    const calcElapsed = () => {
      setElapsed(Date.now() - new Date(state.inicio!).getTime());
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 60_000);
    return () => clearInterval(interval);
  }, [state?.activa, state?.inicio]);

  const handleDeactivate = async () => {
    setDeactivating(true);
    try {
      await fetch('/api/settings/hka/contingency', { method: 'DELETE' });
      setState(null);
    } catch {
      // ignore
    } finally {
      setDeactivating(false);
    }
  };

  if (!state?.activa || !state.inicio) return null;

  const remainingMs = Math.max(0, MAX_HOURS * 3600 * 1000 - elapsed);
  const remainingHours = remainingMs / 1000 / 3600;
  const isUrgent = remainingHours < 8;
  const isExpired = remainingHours <= 0;

  const tipoLabel =
    state.tipo === '04'
      ? 'Fallas en sistemas DGI'
      : 'Corte de internet del contribuyente';

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium mb-4',
        isExpired
          ? 'bg-red-100 dark:bg-red-950/40 border-red-400 dark:border-red-700 text-red-900 dark:text-red-200'
          : isUrgent
          ? 'bg-orange-100 dark:bg-orange-950/30 border-orange-400 dark:border-orange-700 text-orange-900 dark:text-orange-200 animate-pulse'
          : 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
      )}
      role="alert"
    >
      {/* Icono */}
      <div className="mt-0.5 shrink-0">
        {isExpired ? (
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        ) : (
          <WifiOff className="h-5 w-5" />
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">
          {isExpired ? 'PLAZO DE CONTINGENCIA EXPIRADO' : 'MODO CONTINGENCIA ACTIVO'}
        </p>

        <p className="mt-0.5 text-xs opacity-80 leading-snug">
          {tipoLabel}
          {state.motivo && <> &mdash; {state.motivo}</>}
        </p>

        <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1 opacity-75">
            <Clock className="h-3 w-3" />
            Activo hace {formatHorasMinutos(elapsed)}
          </span>

          {isExpired ? (
            <span className="font-semibold text-red-600 dark:text-red-400">
              Plazo de 72h expirado — desactiva el modo para continuar
            </span>
          ) : (
            <span
              className={cn(
                'font-semibold',
                isUrgent && 'text-orange-700 dark:text-orange-300'
              )}
            >
              {formatHorasMinutos(remainingMs)} restantes de 72h
            </span>
          )}
        </div>
      </div>

      {/* Botón desactivar */}
      <button
        onClick={handleDeactivate}
        disabled={deactivating}
        className={cn(
          'shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
          'border-current opacity-70 hover:opacity-100 disabled:opacity-40'
        )}
        title="Desactivar modo contingencia"
      >
        <X className="h-3.5 w-3.5" />
        {deactivating ? 'Desactivando...' : 'Desactivar'}
      </button>
    </div>
  );
}
