/**
 * Worker Executor para Monitores API
 * Ejecuta HTTP requests y captura resultados
 */

import { prisma } from '@core/database';
import { sendMonitorNotification } from '@/lib/notifications/email-notifier';

interface RequestDefinition {
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
}

interface CollectionDefinition {
  requests: RequestDefinition[];
}

export async function executeMonitor(runId: string, collection: CollectionDefinition) {
  const startTime = Date.now();
  let totalRequests = 0;
  let failedRequests = 0;

  try {
    // Ejecutar cada request de la colección
    for (const request of collection.requests) {
      totalRequests++;
      const requestResult = await executeRequest(runId, request);
      if (requestResult.status === 'FAILED') {
        failedRequests++;
      }
    }

    const duration = Date.now() - startTime;

    // Actualizar run como completado
    await prisma.monitorRun.update({
      where: { id: runId },
      data: {
        status: failedRequests > 0 ? 'FAILED' : 'SUCCESS',
        finishedAt: new Date(),
        duration,
        totalRequests,
        failedTests: failedRequests,
      },
    });

    // Enviar notificación si hay fallos
    if (failedRequests > 0) {
      const monitorRun = await prisma.monitorRun.findUnique({
        where: { id: runId },
        include: { monitor: true },
      });

      if (monitorRun?.monitor) {
        await sendMonitorNotification(monitorRun.monitor.id, {
          runId,
          monitorId: monitorRun.monitor.id,
          status: 'FAILED',
          message: `${failedRequests} de ${totalRequests} requests fallaron.`,
          error: monitorRun.error || undefined,
          failedRequests,
          totalRequests,
        });
      }
    }

  } catch (error) {
    console.error('Error ejecutando monitor:', error);

    await prisma.monitorRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
    });

    // Enviar notificación de error
    const monitorRun = await prisma.monitorRun.findUnique({
      where: { id: runId },
      include: { monitor: true },
    });

    if (monitorRun?.monitor) {
      await sendMonitorNotification(monitorRun.monitor.id, {
        runId,
        monitorId: monitorRun.monitor.id,
        status: 'ERROR',
        message: 'Error crítico en la ejecución del monitor.',
        error: error instanceof Error ? error.message : 'Error desconocido',
        failedRequests: totalRequests, // Assume all failed if exception in loop
        totalRequests,
      });
    }
  }
}

async function executeRequest(runId: string, request: RequestDefinition) {
  const startTime = Date.now();
  let status = 'FAILED';
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let error: string | null = null;

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    statusCode = response.status;
    responseBody = await response.text();
    status = response.ok ? 'SUCCESS' : 'FAILED';

  } catch (err) {
    error = err instanceof Error ? err.message : 'Error de red o desconocido';
  } finally {
    const duration = Date.now() - startTime;

    await prisma.monitorRunRequest.create({
      data: {
        runId,
        requestName: request.name,
        method: request.method,
        url: request.url,
        statusCode,
        responseTime: duration,
        passedTests: status === 'SUCCESS' ? 1 : 0,
        failedTests: status === 'FAILED' ? 1 : 0,
        responseBody,
        error,
      },
    });
  }

  return { status, statusCode, error };
}
