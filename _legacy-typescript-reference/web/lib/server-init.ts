/**
 * Server Initialization
 *
 * Este módulo se ejecuta al inicio de la aplicación (server-side)
 * para validar configuración crítica antes de que la app arranque.
 *
 * IMPORTANTE: Importar este archivo en app/layout.tsx o cualquier
 * archivo que se ejecute en el servidor al inicio.
 */

import { validateEnv } from '@core/config/types/env';

// Ejecutar validación solo en server-side
if (typeof window === 'undefined') {
  try {
    console.log('[INFO] Initializing server...');
    validateEnv();
    console.log('[INFO] Server initialization complete');
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    // En desarrollo, permitir continuar con warning
    // En producción, lanzar error
    if (process.env.NODE_ENV === 'production') {
      throw error;
    } else {
      console.warn('[WARN] Continuing in development mode despite validation errors');
    }
  }
}

export { validateEnv, getEnv, isProduction, isDevelopment, isTest } from '@core/config/types/env';
