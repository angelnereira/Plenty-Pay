/**
 * POST /api/invoices/[id]/process
 *
 * Backend Cleaned: Invoice processing logic removed.
 * This endpoint is now a stub pending re-implementation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@core/auth/providers/api-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id: invoiceId } = await params;

    console.log('[Backend-Clean] Process Invoice (PENDING IMPLEMENTATION)', {
      invoiceId,
      userId: session.user.id
    });

    return NextResponse.json({
      success: false,
      error: 'Procesamiento de factura pendiente de implementación',
      message: 'La lógica de procesamiento y envío a HKA ha sido removida y está pendiente de re-implementación.',
    }, { status: 501 });

  } catch (error) {
    console.error('[API] Error en process invoice:', error);
    return NextResponse.json(
      { error: 'Error al procesar factura' },
      { status: 500 }
    );
  }
}

