/**
 * POST /api/invoices-v2/[id]/process
 * Procesar factura con HKA
 */

import { NextRequest, NextResponse } from 'next/server';
import { InvoiceService } from '@/features/invoicing/model';
import { auth } from '@core/auth';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const { id } = await params;

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'No autorizado' },
                { status: 401 }
            );
        }

        // Llamar al Service
        const invoiceService = new InvoiceService();
        const result = await invoiceService.processInvoice(id);

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        // Revalidar el dashboard de inventario tras una venta
        try {
            const { revalidatePath } = await import("next/cache");
            revalidatePath("/dashboard/inventory");
            revalidatePath("/dashboard/inventory/productos");
        } catch (e) {
            console.error("Error revalidating inventory path:", e);
        }

        return NextResponse.json(result);

    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Error al procesar factura' },
            { status: 500 }
        );
    }
}
