import { NextRequest, NextResponse } from 'next/server';
import { posSaleService } from '@/features/pos/services/pos-sale.service';

interface ProcessSaleRequest {
    sessionId: string;
    clientId: string;
    items: Array<{
        productId: string;
        quantity: number;
        price: number;
        name?: string;
    }>;
    paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED';
    customerId?: string;
    notes?: string;
    userId?: string;
}

/**
 * POST /api/pos/process-sale
 * Process a complete sale transaction with ACID guarantees.
 * 
 * - Validates cart
 * - Deducts inventory atomically
 * - Creates sale record
 * - Releases cart reservations
 */
export async function POST(request: NextRequest) {
    try {
        const body: ProcessSaleRequest = await request.json();
        const { sessionId, clientId, items, paymentMethod, customerId, notes, userId } = body;

        if (!sessionId || !clientId || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: 'Missing required fields: sessionId, clientId, items' },
                { status: 400 }
            );
        }

        if (!paymentMethod || !['CASH', 'CARD', 'TRANSFER', 'MIXED'].includes(paymentMethod)) {
            return NextResponse.json(
                { error: 'Invalid paymentMethod. Must be CASH, CARD, TRANSFER, or MIXED' },
                { status: 400 }
            );
        }

        const result = await posSaleService.processSale({
            sessionId,
            clientId,
            items,
            paymentMethod,
            customerId,
            notes,
            userId
        });

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error,
                    failedItems: result.failedItems
                },
                { status: 409 } // Conflict
            );
        }

        return NextResponse.json({
            success: true,
            saleId: result.saleId,
            total: result.total,
            message: 'Venta procesada exitosamente'
        });
    } catch (error: any) {
        console.error('[process-sale] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error procesando venta' },
            { status: 500 }
        );
    }
}
