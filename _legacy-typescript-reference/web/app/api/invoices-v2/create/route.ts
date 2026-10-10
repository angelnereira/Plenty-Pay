/**
 * POST /api/invoices/create
 * Controller: Maneja HTTP - NO tiene lógica de negocio
 */

import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/features/invoicing/model';
import { auth } from '@core/auth';

export async function POST(req: NextRequest) {
    try {
        // 1. Autenticación
        const session = await auth();

        if (!session?.user?.clientId) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // 2. Parse request body
        const body = await req.json();

        // 3. Llamar al Service (donde vive la lógica de negocio)
        const invoiceService = new InvoiceService();
        const result = await invoiceService.createDraft({
            ...body,
            clientId: session.user.clientId,
        });

        // 4. Responder
        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json(result, { status: 201 });

    } catch (error) {
        console.error('Error in POST /api/invoices/create:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
