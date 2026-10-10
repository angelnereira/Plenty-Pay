import { NextRequest, NextResponse } from 'next/server';
import { cartReservationService } from '@/features/pos/services/cart-reservation.service';

/**
 * POST /api/pos/reserve-stock
 * Reserve stock for cart items
 * 
 * Body: { sessionId: string, productId: string, quantity: number }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, productId, quantity } = body;

        if (!sessionId || !productId || quantity === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields: sessionId, productId, quantity' },
                { status: 400 }
            );
        }

        if (quantity < 0) {
            return NextResponse.json(
                { error: 'Quantity must be non-negative' },
                { status: 400 }
            );
        }

        // If quantity is 0, release the reservation
        if (quantity === 0) {
            const reservations = await cartReservationService.getSessionReservations(sessionId);
            const reservation = reservations.find(r => r.productId === productId);

            if (reservation) {
                await cartReservationService.releaseReservation(reservation.id);
            }

            return NextResponse.json({ success: true, released: true });
        }

        const result = await cartReservationService.reserveStock(
            sessionId,
            productId,
            quantity
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error, availableStock: result.availableStock },
                { status: 409 } // Conflict
            );
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error reserving stock:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/pos/reserve-stock?productId=xxx
 * Get available stock for a product (including reservations)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const productId = searchParams.get('productId');

        if (!productId) {
            return NextResponse.json(
                { error: 'Missing productId parameter' },
                { status: 400 }
            );
        }

        const stockInfo = await cartReservationService.getAvailableStock(productId);

        return NextResponse.json({
            currentStock: stockInfo.currentStock.toNumber(),
            reservedStock: stockInfo.reservedStock.toNumber(),
            availableStock: stockInfo.availableStock.toNumber()
        });
    } catch (error: any) {
        console.error('Error getting available stock:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/pos/reserve-stock
 * Release all reservations for a session
 * 
 * Body: { sessionId: string }
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId } = body;

        if (!sessionId) {
            return NextResponse.json(
                { error: 'Missing sessionId' },
                { status: 400 }
            );
        }

        const released = await cartReservationService.releaseSessionReservations(sessionId);

        return NextResponse.json({ success: true, releasedCount: released });
    } catch (error: any) {
        console.error('Error releasing reservations:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
