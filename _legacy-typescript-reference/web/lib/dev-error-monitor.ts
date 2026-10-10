/**
 * DEV ERROR MONITOR - Sistema de Monitoreo de Errores para Desarrollo
 * 
 * Este módulo es TEMPORAL y debe ser eliminado cuando el usuario diga:
 * "elimina el monitoreo de errores"
 * 
 * Propósito:
 * - Capturar errores detallados en frontend y backend
 * - Proporcionar información clara para debugging
 * - Identificar la raíz de los problemas de HKA
 */

export interface DevError {
  id: string;
  timestamp: Date;
  location: 'frontend' | 'backend' | 'hka-service' | 'database' | 'unknown';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  hkaMethod?: string;
  xmlSent?: string;
  xmlReceived?: string;
  httpStatus?: number;
  userId?: string;
  clientId?: string;
  invoiceId?: string;
}

// Almacenamiento en memoria para errores (solo desarrollo)
const errorStore: DevError[] = [];
const MAX_ERRORS = 100;

/**
 * Registra un error en el sistema de monitoreo
 */
export function logDevError(error: Partial<DevError>): DevError {
  const devError: DevError = {
    id: `err_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    timestamp: new Date(),
    location: error.location || 'unknown',
    severity: error.severity || 'error',
    message: error.message || 'Error desconocido',
    stack: error.stack,
    context: error.context,
    hkaMethod: error.hkaMethod,
    xmlSent: error.xmlSent,
    xmlReceived: error.xmlReceived,
    httpStatus: error.httpStatus,
    userId: error.userId,
    clientId: error.clientId,
    invoiceId: error.invoiceId,
  };

  // Agregar al store
  errorStore.unshift(devError);
  
  // Limitar tamaño
  if (errorStore.length > MAX_ERRORS) {
    errorStore.pop();
  }

  // Log detallado a consola
  console.error(`
╔══════════════════════════════════════════════════════════════════════════════╗
║ 🚨 DEV ERROR MONITOR - ${devError.severity.toUpperCase()}
╠══════════════════════════════════════════════════════════════════════════════╣
║ ID: ${devError.id}
║ Timestamp: ${devError.timestamp.toISOString()}
║ Location: ${devError.location}
║ HKA Method: ${devError.hkaMethod || 'N/A'}
╠══════════════════════════════════════════════════════════════════════════════╣
║ Message: ${devError.message}
╠══════════════════════════════════════════════════════════════════════════════╣
${devError.context ? `║ Context: ${JSON.stringify(devError.context, null, 2).split('\n').join('\n║ ')}` : ''}
${devError.stack ? `╠══════════════════════════════════════════════════════════════════════════════╣
║ Stack Trace:
║ ${devError.stack.split('\n').slice(0, 5).join('\n║ ')}` : ''}
${devError.xmlSent ? `╠══════════════════════════════════════════════════════════════════════════════╣
║ XML Enviado (primeros 500 chars):
║ ${devError.xmlSent.substring(0, 500)}...` : ''}
${devError.xmlReceived ? `╠══════════════════════════════════════════════════════════════════════════════╣
║ XML Recibido (primeros 500 chars):
║ ${devError.xmlReceived.substring(0, 500)}...` : ''}
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  return devError;
}

/**
 * Obtiene todos los errores registrados
 */
export function getDevErrors(): DevError[] {
  return [...errorStore];
}

/**
 * Limpia el store de errores
 */
export function clearDevErrors(): void {
  errorStore.length = 0;
}

/**
 * Wrapper para capturar errores en funciones async
 */
export async function withDevErrorCapture<T>(
  fn: () => Promise<T>,
  context: Partial<DevError>
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    logDevError({
      ...context,
      message: error.message || String(error),
      stack: error.stack,
      severity: 'error',
    });
    throw error;
  }
}

/**
 * Crea un reporte de diagnóstico
 */
export function generateDiagnosticReport(): string {
  const errors = getDevErrors();
  const byLocation = errors.reduce((acc, e) => {
    acc[e.location] = (acc[e.location] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byMethod = errors.reduce((acc, e) => {
    if (e.hkaMethod) {
      acc[e.hkaMethod] = (acc[e.hkaMethod] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    REPORTE DE DIAGNÓSTICO - DEV ERROR MONITOR                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Total de errores capturados: ${errors.length}
║ 
║ Por ubicación:
${Object.entries(byLocation).map(([k, v]) => `║   - ${k}: ${v}`).join('\n')}
║ 
║ Por método HKA:
${Object.entries(byMethod).map(([k, v]) => `║   - ${k}: ${v}`).join('\n')}
║ 
║ Últimos 5 errores:
${errors.slice(0, 5).map((e, i) => `║   ${i + 1}. [${e.severity}] ${e.message.substring(0, 60)}...`).join('\n')}
╚══════════════════════════════════════════════════════════════════════════════╝
`;
}

