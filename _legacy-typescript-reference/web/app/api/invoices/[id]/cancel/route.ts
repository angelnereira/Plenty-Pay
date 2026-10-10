/**
 * API ENDPOINT: Anular Factura Certificada
 * POST /api/invoices/[id]/cancel
 *
 * Backend Cleaned: HKA cancellation logic removed.
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

    console.log('[Backend-Clean] Cancel Invoice (PENDING IMPLEMENTATION)', { invoiceId });

    return NextResponse.json({
      success: false,
      error: 'Anulación de factura pendiente de implementación',
      message: 'La lógica de anulación HKA ha sido removida y está pendiente de re-implementación.',
    }, { status: 501 });

  } catch (error) {
    console.error('[API] Error en cancel invoice:', error);
    return NextResponse.json(
      { error: 'Error al procesar anulación' },
      { status: 500 }
    );
  }
}
