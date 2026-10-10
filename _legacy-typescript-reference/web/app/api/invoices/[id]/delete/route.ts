import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@core/database';
import { auth } from '@core/auth';

/**
 * DELETE /api/invoices/[id]/delete
 * Elimina una factura de la base de datos (solo si está en DRAFT o ERROR)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: invoiceId } = await params;

    // Verificar que la factura existe y pertenece a la organización
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        clientId: true,
        status: true,
        invoiceNumber: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    if (invoice.clientId !== session.user.clientId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // ✅ PERMITIR ELIMINAR CUALQUIER FACTURA
    // Las facturas certificadas pueden recuperarse después usando:
    // - Consulta por CUFE
    // - Descarga de PDF desde HKA
    // - Descarga de XML desde HKA
    // Nota: Esta eliminación es de la base de datos local, NO anula la factura en DGI


    // Eliminar items de la factura primero
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId },
    });

    // Eliminar deliveries de email si existen
    await prisma.emailDelivery.deleteMany({
      where: { invoiceId },
    });

    // Eliminar la factura
    await prisma.invoice.delete({
      where: { id: invoiceId },
    });

    console.log(`✅ Factura ${invoice.invoiceNumber || invoiceId} eliminada por ${session.user.email}`);

    return NextResponse.json({
      success: true,
      message: 'Factura eliminada correctamente',
      invoiceId,
    });
  } catch (error) {
    console.error('Error al eliminar factura:', error);
    return NextResponse.json(
      {
        error: 'Error al eliminar factura',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices/[id]/delete (alternativa)
 * Algunos clientes prefieren POST para acciones destructivas
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return DELETE(request, { params });
}
