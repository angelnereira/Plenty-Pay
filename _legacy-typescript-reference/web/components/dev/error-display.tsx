'use client';

/**
 * DEV ERROR DISPLAY - Componente de visualización de errores para desarrollo
 * 
 * Este componente es TEMPORAL y debe ser eliminado cuando el usuario diga:
 * "elimina el monitoreo de errores"
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '@shared/ui/button';

interface DevErrorInfo {
  timestamp: string;
  location: string;
  severity: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  hkaMethod?: string;
}

// Store global de errores en el frontend
const frontendErrors: DevErrorInfo[] = [];

/**
 * Registra un error en el frontend
 */
export function logFrontendError(error: Partial<DevErrorInfo>): void {
  const errorInfo: DevErrorInfo = {
    timestamp: new Date().toISOString(),
    location: error.location || 'frontend',
    severity: error.severity || 'error',
    message: error.message || 'Error desconocido',
    stack: error.stack,
    context: error.context,
    hkaMethod: error.hkaMethod,
  };
  
  frontendErrors.unshift(errorInfo);
  
  // Limitar a 50 errores
  if (frontendErrors.length > 50) {
    frontendErrors.pop();
  }
  
  // Log detallado a consola
  console.error(`
🚨 [DEV ERROR] ${errorInfo.severity.toUpperCase()}
📍 Location: ${errorInfo.location}
📝 Message: ${errorInfo.message}
${errorInfo.hkaMethod ? `🔌 HKA Method: ${errorInfo.hkaMethod}` : ''}
${errorInfo.context ? `📦 Context: ${JSON.stringify(errorInfo.context, null, 2)}` : ''}
${errorInfo.stack ? `📚 Stack: ${errorInfo.stack.split('\n').slice(0, 3).join('\n')}` : ''}
`);
  
  // Disparar evento para actualizar UI
  window.dispatchEvent(new CustomEvent('dev-error', { detail: errorInfo }));
}

/**
 * Obtiene todos los errores del frontend
 */
export function getFrontendErrors(): DevErrorInfo[] {
  return [...frontendErrors];
}

/**
 * Componente flotante para mostrar errores en desarrollo
 */
export function DevErrorPanel() {
  const [errors, setErrors] = useState<DevErrorInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [expandedError, setExpandedError] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Cargar errores iniciales
    setErrors(getFrontendErrors());
    
    // Escuchar nuevos errores
    const handleError = (e: CustomEvent<DevErrorInfo>) => {
      setErrors(getFrontendErrors());
      setIsOpen(true); // Abrir automáticamente cuando hay nuevo error
    };
    
    window.addEventListener('dev-error', handleError as EventListener);
    
    return () => {
      window.removeEventListener('dev-error', handleError as EventListener);
    };
  }, []);

  const copyAllErrors = () => {
    const text = errors.map(e => 
      `[${e.timestamp}] ${e.severity.toUpperCase()} - ${e.message}\n${e.stack || ''}`
    ).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearErrors = () => {
    frontendErrors.length = 0;
    setErrors([]);
  };

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-lg">
      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors"
      >
        <AlertTriangle className="h-5 w-5" />
        <span className="font-medium">{errors.length} Error{errors.length > 1 ? 'es' : ''}</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {/* Panel de errores */}
      {isOpen && (
        <div className="mt-2 bg-gray-900 border border-red-500/50 rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-red-900/50 border-b border-red-500/30">
            <span className="text-sm font-semibold text-red-200">
              DEV Error Monitor (Temporal)
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={copyAllErrors}
                className="h-7 px-2 text-red-200 hover:text-white hover:bg-red-800"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearErrors}
                className="h-7 px-2 text-red-200 hover:text-white hover:bg-red-800"
              >
                Limpiar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="h-7 px-2 text-red-200 hover:text-white hover:bg-red-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de errores */}
          <div className="max-h-96 overflow-y-auto scrollbar-hide">
            {errors.map((error, index) => (
              <div
                key={index}
                className="border-b border-gray-800 last:border-0"
              >
                {/* Error header */}
                <button
                  onClick={() => setExpandedError(expandedError === index ? null : index)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      error.severity === 'critical' ? 'bg-red-600 text-white' :
                      error.severity === 'error' ? 'bg-orange-600 text-white' :
                      error.severity === 'warning' ? 'bg-yellow-600 text-black' :
                      'bg-blue-600 text-white'
                    }`}>
                      {error.severity.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{error.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {error.location} {error.hkaMethod && `• ${error.hkaMethod}`} • {new Date(error.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    {expandedError === index ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </button>

                {/* Error details */}
                {expandedError === index && (
                  <div className="px-4 pb-3 space-y-2">
                    {error.context && (
                      <div className="p-2 bg-gray-800 rounded text-xs">
                        <p className="text-gray-400 mb-1">Context:</p>
                        <pre className="text-gray-300 overflow-x-auto scrollbar-hide">
                          {JSON.stringify(error.context, null, 2)}
                        </pre>
                      </div>
                    )}
                    {error.stack && (
                      <div className="p-2 bg-gray-800 rounded text-xs">
                        <p className="text-gray-400 mb-1">Stack Trace:</p>
                        <pre className="text-red-400 overflow-x-auto scrollbar-hide whitespace-pre-wrap">
                          {error.stack.split('\n').slice(0, 5).join('\n')}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

