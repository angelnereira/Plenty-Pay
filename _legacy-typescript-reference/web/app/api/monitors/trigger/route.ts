/**
 * API: Trigger Manual de Monitor
 * POST /api/monitors/trigger
 * 
 * Ejecutar un monitor manualmente
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';
import { createErrorResponse } from '@/lib/utils/api-error-response';
import { executeMonitor } from '@/lib/monitoring/worker-executor';

export async function POST(request: NextRequest) {
  let session: any;
  try {
    session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Solo SUPER_ADMIN
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });
    }

    const body = await request.json();
    const { monitorId } = body;

    if (!monitorId) {
      return NextResponse.json({ error: 'monitorId es requerido' }, { status: 400 });
    }

    // Buscar monitor
    const monitor = await prisma.monitor.findUnique({
      where: { id: monitorId },
      include: { collection: true },
    });

    if (!monitor) {
      return NextResponse.json({ error: 'Monitor no encontrado' }, { status: 404 });
    }

    // Crear run
    const run = await prisma.monitorRun.create({
      data: {
        monitorId,
        status: 'RUNNING',
        startedAt: new Date(),
        triggeredBy: session.user.id,
      },
    });

    // Ejecutar monitor asíncronamente
    if (monitor.collection && monitor.collection.definition) {
      executeMonitor(run.id, monitor.collection.definition as any);
    }

    return NextResponse.json({
      success: true,
      runId: run.id,
      message: 'Monitor ejecutándose',
    });
  } catch (error) {
    return createErrorResponse(
      error,
      500,
      session?.user?.role,
      session?.user?.id
    );
  }
}

