import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { prisma } from '@core/database';

/**
 * GET /api/invoices/[id]/email/history
 * Obtiene el historial de correos enviados para una factura
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id: invoiceId } = await params;

    // Obtener factura para verificar acceso
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 }
      );
    }

    // Verificar que el usuario tiene acceso a esta factura
    if (invoice.clientId !== session.user.clientId && session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para acceder a esta factura' },
        { status: 403 }
      );
    }

    // Obtener historial de correos
    const emailDeliveries = await prisma.emailDelivery.findMany({
      where: { invoiceId: invoiceId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: emailDeliveries,
    });
  } catch (error) {
    console.error('Error al obtener historial de correos:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al obtener historial de correos',
      },
      { status: 500 }
    );
  }
}
