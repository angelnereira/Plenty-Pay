import { NextRequest, NextResponse } from 'next/server';
import { posSaleService } from '@/features/pos/services/pos-sale.service';

interface ValidateCartRequest {
    sessionId?: string; // Optional - if not provided, we'll generate a temporary one
    items: Array<{
        productId: string;
        quantity: number;
        price?: number;
        name?: string;
    }>;
}

/**
 * POST /api/pos/validate-cart
 * Pre-validate cart items before checkout.
 * Returns validation result with any stock availability issues.
 * 
 * Note: sessionId is optional. If not provided, validation will still check
 * current stock levels without considering session-specific reservations.
 */
export async function POST(request: NextRequest) {
    try {
        const body: ValidateCartRequest = await request.json();
        const { items } = body;
        // Generate a temporary sessionId if not provided
        const sessionId = body.sessionId || `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        if (!items || !Array.isArray(items)) {
            return NextResponse.json(
                { error: 'Missing required field: items' },
                { status: 400 }
            );
        }

        if (items.length === 0) {
            return NextResponse.json({
                valid: true,
                issues: [],
                message: 'Carrito vacío'
            });
        }

        // Validate each item has required fields
        for (const item of items) {
            if (!item.productId || item.quantity === undefined || item.quantity < 0) {
                return NextResponse.json(
                    { error: 'Each item must have productId and quantity >= 0' },
                    { status: 400 }
                );
            }
        }

        // Map items to ensure price has a default value (required by CartItem type)
        const cartItems = items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price ?? 0, // Price is not used for validation, default to 0
            name: item.name
        }));

        const validation = await posSaleService.validateCart(sessionId, cartItems);

        return NextResponse.json({
            valid: validation.valid,
            issues: validation.issues,
            message: validation.valid
                ? 'Carrito válido - listo para checkout'
                : `${validation.issues.length} producto(s) con stock insuficiente`
        });
    } catch (error: any) {
        console.error('[validate-cart] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error validando carrito' },
            { status: 500 }
        );
    }
}
