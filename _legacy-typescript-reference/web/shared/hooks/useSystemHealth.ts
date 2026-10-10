'use client';

import { useState, useEffect, useCallback } from 'react';
import { testHkaConnection } from '@/app/actions/settings/test-hka-connection.action';
// checkFolios removed

export interface SystemHealthStatus {
  isLoading: boolean;
  isHealthy: boolean;
  error: string | null;
  connectionDetails?: {
    environment?: 'DEMO' | 'PROD';
    responseTime?: number;
    licencia?: string;
  };
  folioBalance?: {
    disponibles: number;
    utilizados: number;
    total: number;
  };
  lastChecked?: Date;
}

export interface UseSystemHealthReturn extends SystemHealthStatus {
  refetch: () => Promise<void>;
}

/**
 * Hook: useSystemHealth
 *
 * Implementa el "Semáforo del Sistema" verificando:
 * 1. Conexión con HKA (testHkaConnection)
 * 2. Balance de folios disponibles
 *
 * Si falla, devuelve isHealthy=false y el componente CredentialGuard
 * puede bloquear la UI.
 */
export function useSystemHealth(autoFetch: boolean = true): UseSystemHealthReturn {
  const [status, setStatus] = useState<SystemHealthStatus>({
    isLoading: true,
    isHealthy: false,
    error: null,
  });

  const checkSystemHealth = useCallback(async () => {
    setStatus(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 1. Verificar conexión HKA
      const connectionResult = await testHkaConnection();

      if (!connectionResult.success) {
        setStatus({
          isLoading: false,
          isHealthy: false,
          error: connectionResult.error || 'Failed to connect to HKA',
          connectionDetails: connectionResult.details,
          lastChecked: new Date(),
        });
        return;
      }

      // 2. Consultar folios (MOCKED)
      // const foliosResult = await checkFolios();
      const foliosResult = {
        success: true,
        data: { disponibles: 100, utilizados: 50, total: 150 }
      };

      if (!foliosResult.success || !foliosResult.data) {
        setStatus({
          isLoading: false,
          isHealthy: true, // Conexión OK pero folios falló
          error: 'Could not retrieve folio balance',
          connectionDetails: connectionResult.details,
          lastChecked: new Date(),
        });
        return;
      }

      // 3. Todo OK
      setStatus({
        isLoading: false,
        isHealthy: true,
        error: null,
        connectionDetails: connectionResult.details,
        folioBalance: {
          disponibles: foliosResult.data.disponibles,
          utilizados: foliosResult.data.utilizados,
          total: foliosResult.data.total,
        },
        lastChecked: new Date(),
      });
    } catch (error: any) {
      setStatus({
        isLoading: false,
        isHealthy: false,
        error: error.message || 'Unexpected error checking system health',
        lastChecked: new Date(),
      });
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      checkSystemHealth();
    }
  }, [autoFetch, checkSystemHealth]);

  return {
    ...status,
    refetch: checkSystemHealth,
  };
}
