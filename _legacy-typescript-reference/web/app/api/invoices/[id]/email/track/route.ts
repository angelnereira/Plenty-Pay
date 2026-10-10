import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@core/auth';
import { trackInvoiceEmailAction } from '@/app/actions/invoice/track-email.action';

/**
 * POST /api/invoices/[id]/email/track
 * Rastrea el estado de los correos enviados para una factura via HKA.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: invoiceId } = await params;
    const result = await trackInvoiceEmailAction(invoiceId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('[API] Error en email track:', error);
    return NextResponse.json({ error: 'Error al rastrear email' }, { status: 500 });
  }
}
