import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';

/**
 * GET /api/admin/api-logs
 * Obtiene los logs de llamadas a APIs (solo Super Admin)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Solo Super Admin puede ver estos logs
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo Super Admin.' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const endpoint = url.searchParams.get('endpoint');
    const method = url.searchParams.get('method');
    const statusCode = url.searchParams.get('statusCode') ? parseInt(url.searchParams.get('statusCode')!) : null;
    const success = url.searchParams.get('success') === 'true' ? true : url.searchParams.get('success') === 'false' ? false : null;
    const apiName = url.searchParams.get('apiName');
    const userId = url.searchParams.get('userId');
    const clientId = url.searchParams.get('clientId');
    const fromDate = url.searchParams.get('fromDate');
    const toDate = url.searchParams.get('toDate');

    // Construir filtros
    const where: any = {};

    if (endpoint) {
      where.endpoint = { contains: endpoint, mode: 'insensitive' };
    }

    if (method) {
      where.method = method;
    }

    if (statusCode !== null) {
      where.statusCode = statusCode;
    }

    if (success !== null) {
      where.success = success;
    }

    if (apiName) {
      where.apiName = apiName;
    }

    if (userId) {
      where.userId = userId;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    // Contar total
    const total = await prisma.apiLog.count({ where });

    // Obtener logs
    const logs = await prisma.apiLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            ruc: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Estadísticas agregadas
    const totalSuccess = await prisma.apiLog.count({ where: { ...where, success: true } });
    const totalErrors = await prisma.apiLog.count({ where: { ...where, success: false } });
    const avgDuration = await prisma.apiLog.aggregate({
      where: { ...where, duration: { not: null } },
      _avg: { duration: true },
    });

    // Endpoints más usados
    const popularEndpoints = await prisma.apiLog.groupBy({
      by: ['endpoint'],
      where,
      _count: true,
      orderBy: {
        _count: {
          endpoint: 'desc',
        },
      },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        stats: {
          totalSuccess,
          totalErrors,
          avgDuration: (avgDuration as any)._avg?.duration,
          popularEndpoints: popularEndpoints.map((e: any) => ({
            endpoint: e.endpoint,
            count: e._count,
          })),
        },
      },
    });
  } catch (error) {
    console.error('[API] Error al obtener logs de API:', error);
    return NextResponse.json(
      { error: 'Error al obtener logs de API' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/api-logs
 * Elimina logs antiguos (solo Super Admin)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Solo Super Admin puede eliminar logs
    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Acceso denegado. Solo Super Admin.' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const daysToKeep = parseInt(url.searchParams.get('daysToKeep') || '30');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const deleted = await prisma.apiLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Se eliminaron ${deleted.count} logs anteriores a ${cutoffDate.toISOString()}`,
      deleted: deleted.count,
    });
  } catch (error) {
    console.error('[API] Error al eliminar logs:', error);
    return NextResponse.json(
      { error: 'Error al eliminar logs' },
      { status: 500 }
    );
  }
}

