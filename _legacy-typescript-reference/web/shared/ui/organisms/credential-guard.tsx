'use client';

// Imports removed - health check functionality disabled
// import { useSystemHealth } from '@shared/hooks/useSystemHealth';
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
// import { Button } from '@shared/ui/button';
// import { AlertCircle, Loader2, RefreshCw, Settings, CheckCircle2, XCircle } from 'lucide-react';
// import Link from 'next/link';
// import { FolioCounter } from '@shared/ui/atoms/folio-counter';
// import { usePathname } from 'next/navigation';


interface CredentialGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Componente Organism: CredentialGuard
 *
 * Wrapper que envuelve la aplicación y verifica el "Semáforo del Sistema":
 * 1. Ejecuta Consultar RUC/DV para verificar credenciales HKA
 * 2. Si falla: Muestra pantalla de error/configuración (bloquea UI)
 * 3. Si tiene éxito: Muestra el dashboard y carga folios restantes
 *
 * Este componente implementa el patrón de "Validación Inicial" del plan.
 */
export function CredentialGuard({ children, fallback }: CredentialGuardProps) {
  // DISABLED: Health check blocking removed to allow application access
  // Users can configure HKA credentials from settings without being blocked

  // Always render children without health checks
  return (
    <div className="relative">
      {children}
    </div>
  );
}

/**
 * Hook para acceder al estado del sistema desde cualquier componente
 * DISABLED: Health check functionality removed
 */
export function useSystemStatus() {
  // Health checks disabled - return default healthy state
  return {
    isLoading: false,
    isHealthy: true,
    error: null,
    connectionDetails: null,
    folioBalance: null,
    refetch: () => Promise.resolve()
  };
}
