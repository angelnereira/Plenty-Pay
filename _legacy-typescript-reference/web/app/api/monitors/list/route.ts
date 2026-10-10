/**
 * API: Listar Monitores
 * GET /api/monitors/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const monitors = await prisma.monitor.findMany({
      include: {
        runs: {
          take: 5,
          orderBy: { startedAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      monitors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al listar monitores' },
      { status: 500 }
    );
  }
}

