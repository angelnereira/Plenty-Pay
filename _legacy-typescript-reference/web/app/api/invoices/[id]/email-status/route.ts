import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@core/auth/providers/api-helpers';

/**
 * GET /api/invoices/[id]/email-status
 *
 * Backend Cleaned: HKA email status logic removed.
 * This endpoint is now a stub pending re-implementation.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(request);
        const { id: invoiceId } = await params;

        console.log('[Backend-Clean] Email Status (PENDING IMPLEMENTATION)', { invoiceId });

        return NextResponse.json({
            success: false,
            error: 'Consulta de estado de email pendiente de implementación',
            message: 'La lógica de rastreo de correo HKA ha sido removida y está pendiente de re-implementación.',
        }, { status: 501 });

    } catch (error) {
        console.error('[API] Error en email status:', error);
        return NextResponse.json(
            { error: 'Error al consultar estado de email' },
            { status: 500 }
        );
    }
}
