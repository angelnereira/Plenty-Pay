'use client';

/**
 * Folios Widget
 * Muestra balance de folios HKA en dashboard
 */

import { useState, useEffect } from 'react';
import { Button } from '@shared/ui/button';
import { Progress } from '@shared/ui/progress';
import { Badge } from '@shared/ui/badge';
import { Loader2, RefreshCw, AlertTriangle, FileText } from 'lucide-react';
// HKA imports removed for hollow backend

// Type definition moved here
interface FolioBalance {
  disponibles: number;
  utilizados: number;
  total: number;
  porcentajeUso: number;
  alertaBajo: boolean;
  licencia?: string;
  fechaLicencia?: string;
}

export function FoliosWidget() {
  const [balance, setBalance] = useState<FolioBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFolios = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Mock data for Hollow Backend
      console.log('[Frontend-Clean] Folios Loading (MOCKED)');

      // Simulate network delay
      await new Promise(r => setTimeout(r, 1000));

      setBalance({
        disponibles: 100,
        utilizados: 50,
        total: 150,
        porcentajeUso: 33.3,
        alertaBajo: false
      });

    } catch (err: any) {
      setError('An error occurred while loading folios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFolios();
  }, []);

  const handleRefresh = () => {
    loadFolios();
  };

  if (isLoading && !balance) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">Balance de Folios</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Cargando...</p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">Balance de Folios</h3>
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Title and Alert */}
        <div className="flex items-center gap-3 lg:min-w-[200px]">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              Balance de Folios
              {balance.alertaBajo && (
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              )}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">HKA/DGI</p>
          </div>
        </div>

        {/* Stats - Horizontal Layout */}
        <div className="flex-1 grid grid-cols-3 gap-4 lg:gap-6">
          <div className="text-center lg:text-left">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Disponibles</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {balance.disponibles.toLocaleString()}
            </p>
          </div>
          <div className="text-center lg:text-left">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Utilizados</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {balance.utilizados.toLocaleString()}
            </p>
          </div>
          <div className="text-center lg:text-left">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {balance.total.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Progress and Actions */}
        <div className="flex items-center gap-4 lg:min-w-[280px]">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Uso</span>
              <Badge
                variant={balance.alertaBajo ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {balance.porcentajeUso.toFixed(1)}%
              </Badge>
            </div>
            <Progress
              value={balance.porcentajeUso}
              className="h-2"
            />
            {balance.alertaBajo && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                ¡Saldo bajo!
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex-shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    </div>
  );
}
