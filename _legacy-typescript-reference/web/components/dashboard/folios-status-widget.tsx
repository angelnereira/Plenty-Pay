'use client';

import { useState, useEffect } from 'react';
import { Package, AlertTriangle, Loader2 } from 'lucide-react';
import { checkFoliosAction } from '@/app/actions/hka/check-folios.action';
import { cn } from '@/lib/utils';

interface FolioData {
  disponibles: number;
  utilizados: number;
  total: number;
  porcentaje: number;
  licencia?: string;
  ciclo?: string;
}

interface FoliosStatusWidgetProps {
  initialData?: any;
}

/**
 * Folios Status Widget - Refactorizado
 * Muestra estado de folios HKA con mejor UX y handling de respuestas
 */
export function FoliosStatusWidget({ initialData }: FoliosStatusWidgetProps = {}) {
  const [folios, setFolios] = useState<FolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Función para cargar folios desde HKA
  const loadFolios = async () => {
    try {
      console.log('🔄 Loading folios from HKA...');
      const result = await checkFoliosAction();

      console.log('📊 Folios result:', result);

      if (result.success && result.data) {
        // Calcular folios disponibles: total del ciclo - utilizados del ciclo
        const totalCiclo = result.data.foliosTotalesCiclo || 0;
        const utilizadosCiclo = result.data.foliosUtilizadosCiclo || 0;
        const disponiblesCiclo = totalCiclo - utilizadosCiclo;

        const newData: FolioData = {
          disponibles: disponiblesCiclo,
          utilizados: utilizadosCiclo,
          total: totalCiclo,
          porcentaje: result.data.porcentajeUso || 0,
          licencia: result.data.licencia,
          ciclo: result.data.ciclo,
        };

        console.log('✅ Setting folios data:', newData);
        setFolios(newData);
        setError(null);
        setLastUpdate(new Date());
      } else {
        // Mensajes de error más específicos
        let errorMsg = result.error || 'Error al cargar folios';

        if (errorMsg.includes('HKA') || errorMsg.includes('configuración') || errorMsg.includes('Configuration')) {
          errorMsg = 'Configure HKA';
        } else if (errorMsg.includes('token') || errorMsg.includes('credencial')) {
          errorMsg = 'Credenciales inválidas';
        } else if (errorMsg.includes('conexión') || errorMsg.includes('timeout')) {
          errorMsg = 'Error de conexión';
        } else if (errorMsg.includes('autori')) {
          errorMsg = 'No autorizado';
        }

        console.error('Error loading folios:', errorMsg);
        setError(errorMsg);
        setFolios(null);
      }
    } catch (err) {
      console.error('Exception loading folios:', err);
      setError('Error inesperado');
      setFolios(null);
    }
  };

  // Cargar folios al montar
  useEffect(() => {
    const initialLoad = async () => {
      setIsLoading(true);
      await loadFolios();
      setIsLoading(false);
    };

    initialLoad();

    // Refrescar cada 30 minutos (en lugar de 1 hora)
    const interval = setInterval(loadFolios, 1800000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await loadFolios();
    setIsRefreshing(false);
  };

  // Configuración de colores según estado
  const getProgressConfig = (disponibles: number, porcentaje: number) => {
    // Crítico: menos de 10 folios disponibles
    if (disponibles < 10) {
      return {
        barColor: 'bg-red-500',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        textColor: 'text-red-600 dark:text-red-400',
        borderColor: 'border-red-300 dark:border-red-700',
        cardBg: 'bg-red-50/50 dark:bg-red-900/10',
        iconBg: 'bg-red-100 dark:bg-red-900/40',
        icon: Package,
        pulseColor: 'bg-red-500',
      };
    }
    // Warning: menos de 50 folios o más del 70% usado
    if (disponibles < 50 || porcentaje > 70) {
      return {
        barColor: 'bg-amber-500',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        textColor: 'text-amber-700 dark:text-amber-400',
        borderColor: 'border-amber-300 dark:border-amber-700',
        cardBg: 'bg-amber-50/50 dark:bg-amber-900/10',
        iconBg: 'bg-amber-100 dark:bg-amber-900/40',
        icon: Package,
        pulseColor: 'bg-amber-500',
      };
    }
    // OK: suficientes folios
    return {
      barColor: 'bg-emerald-500',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      textColor: 'text-emerald-700 dark:text-emerald-400',
      borderColor: 'border-emerald-300 dark:border-emerald-700',
      cardBg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      icon: Package,
      pulseColor: 'bg-emerald-500',
    };
  };

  // Loading state - Responsivo
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 md:gap-3 px-2 md:px-4 py-2 md:py-2.5 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin text-gray-400" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3 md:h-4 w-14 md:w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
          <div className="hidden md:block h-2 w-28 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state - Responsivo
  if (error || !folios) {
    return (
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className={cn(
          "flex items-center gap-1.5 md:gap-2.5 px-2 md:px-3.5 py-2 md:py-2.5 rounded-lg border transition-all duration-200",
          "bg-red-50/80 dark:bg-red-900/20 border-red-300 dark:border-red-800",
          "hover:bg-red-100 dark:hover:bg-red-900/30 hover:shadow-sm",
          "disabled:opacity-70 disabled:cursor-not-allowed"
        )}
        title={error || "Error al cargar folios - Click para reintentar"}
      >
        <div className="relative">
          <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-red-500" />
          {!isRefreshing && (
            <div className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-xs md:text-sm font-semibold text-red-700 dark:text-red-400 max-w-[60px] md:max-w-none truncate">
            {error || 'Error'}
          </span>
          <span className="hidden md:block text-[10px] text-red-600/70 dark:text-red-400/70">
            Click para reintentar
          </span>
        </div>
        {isRefreshing && (
          <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin text-red-500" />
        )}
      </button>
    );
  }

  const config = getProgressConfig(folios.disponibles, folios.porcentaje);
  const IconComponent = config.icon;

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={cn(
        "relative flex items-center gap-1.5 md:gap-3 px-2 md:px-3.5 py-1.5 md:py-2.5 rounded-lg border transition-all duration-200",
        "hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
        "disabled:opacity-70 disabled:cursor-not-allowed",
        config.cardBg,
        config.borderColor
      )}
      title={`Folios HKA - Ciclo ${folios.ciclo || 'N/A'} - Click para actualizar`}
    >
      {/* Icono con estado - más pequeño en móvil */}
      <div className="relative">
        <div className={cn("p-1 md:p-1.5 rounded-md", config.iconBg)}>
          <IconComponent className={cn("h-3 w-3 md:h-4 md:w-4", config.textColor)} />
        </div>
        {folios.disponibles < 10 && (
          <div className={cn(
            "absolute -top-1 -right-1 h-2 w-2 md:h-2.5 md:w-2.5 rounded-full",
            "animate-pulse border-2 border-white dark:border-gray-900",
            config.pulseColor
          )} />
        )}
      </div>

      {/* Contenido - versión simplificada: solo folios disponibles */}
      <div className="flex flex-col gap-0.5 md:gap-1">
        {/* Número principal: folios disponibles este mes */}
        <div className="flex items-baseline gap-1">
          <span className={cn("text-base md:text-lg font-bold tabular-nums leading-none", config.textColor)}>
            {folios.disponibles.toLocaleString()}
          </span>
        </div>

        {/* Etiqueta descriptiva */}
        <span className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 leading-none whitespace-nowrap">
          folios este mes
        </span>
      </div>

      {/* Indicador de refresh */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-white/60 dark:bg-gray-900/60 rounded-lg flex items-center justify-center backdrop-blur-sm">
          <Loader2 className={cn("h-6 w-6 animate-spin", config.textColor)} />
        </div>
      )}

      {/* Timestamp del último update (tooltip)*/}
      {lastUpdate && (
        <span className="sr-only">
          Última actualización: {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </button>
  );
}
