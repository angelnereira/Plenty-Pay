import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';
import {
    InsufficientStockError,
    ReservationExpiredError
} from '@/shared/errors/inventory-errors';

const RESERVATION_TTL_MINUTES = 15;

interface ReservationResult {
    success: boolean;
    reservationId?: string;
    availableStock?: number;
    error?: string;
}

interface AvailableStockResult {
    currentStock: Decimal;
    reservedStock: Decimal;
    availableStock: Decimal;
}

/**
 * Cart Reservation Service
 * Implements soft-lock pattern for inventory with TTL-based auto-expiration.
 * 
 * Key features:
 * - Reserve stock when adding to cart
 * - Auto-expire reservations after 15 minutes
 * - Calculate available stock (actual - reserved)
 * - Release reservations on checkout or cart clear
 */
export class CartReservationService {
    /**
     * Get available stock for a product, accounting for active reservations.
     * Available = Current Stock - Active Reservations
     */
    async getAvailableStock(productId: string): Promise<AvailableStockResult> {
        const [product, reservationsSum] = await Promise.all([
            prisma.product.findUnique({
                where: { id: productId },
                select: { currentStock: true }
            }),
            prisma.cartReservation.aggregate({
                where: {
                    productId,
                    expiresAt: { gt: new Date() }
                },
                _sum: { quantity: true }
            })
        ]);

        if (!product) {
            throw new Error(`Producto no encontrado: ${productId}`);
        }

        const currentStock = product.currentStock;
        const reservedStock = reservationsSum._sum.quantity || new Decimal(0);
        const availableStock = currentStock.minus(reservedStock);

        return {
            currentStock,
            reservedStock,
            availableStock
        };
    }

    /**
     * Reserve stock for a cart item.
     * Creates a soft lock with TTL expiration.
     */
    async reserveStock(
        sessionId: string,
        productId: string,
        quantity: number
    ): Promise<ReservationResult> {
        // Check available stock
        const { availableStock } = await this.getAvailableStock(productId);

        if (availableStock.lessThan(quantity)) {
            return {
                success: false,
                availableStock: availableStock.toNumber(),
                error: `Stock insuficiente. Disponible: ${availableStock.toNumber()}`
            };
        }

        // Check if user already has a reservation for this product
        const existingReservation = await prisma.cartReservation.findFirst({
            where: {
                sessionId,
                productId,
                expiresAt: { gt: new Date() }
            }
        });

        const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

        if (existingReservation) {
            // Update existing reservation
            const updated = await prisma.cartReservation.update({
                where: { id: existingReservation.id },
                data: {
                    quantity: new Decimal(quantity),
                    expiresAt
                }
            });

            return {
                success: true,
                reservationId: updated.id,
                availableStock: availableStock.minus(quantity).toNumber()
            };
        }

        // Create new reservation
        const reservation = await prisma.cartReservation.create({
            data: {
                sessionId,
                productId,
                quantity: new Decimal(quantity),
                expiresAt
            }
        });

        return {
            success: true,
            reservationId: reservation.id,
            availableStock: availableStock.minus(quantity).toNumber()
        };
    }

    /**
     * Extend reservation TTL (heartbeat).
     * Call this periodically while user is active to prevent expiration.
     */
    async extendReservation(reservationId: string): Promise<boolean> {
        const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000);

        const result = await prisma.cartReservation.updateMany({
            where: {
                id: reservationId,
                expiresAt: { gt: new Date() } // Only extend if not expired
            },
            data: { expiresAt }
        });

        return result.count > 0;
    }

    /**
     * Release a specific reservation (e.g., when removing from cart).
     */
    async releaseReservation(reservationId: string): Promise<boolean> {
        const result = await prisma.cartReservation.delete({
            where: { id: reservationId }
        }).catch(() => null);

        return result !== null;
    }

    /**
     * Release all reservations for a session (e.g., on checkout or cart clear).
     */
    async releaseSessionReservations(sessionId: string): Promise<number> {
        const result = await prisma.cartReservation.deleteMany({
            where: { sessionId }
        });

        return result.count;
    }

    /**
     * Clean up expired reservations.
     * Should be called by a cron job every few minutes.
     */
    async cleanupExpiredReservations(): Promise<number> {
        const result = await prisma.cartReservation.deleteMany({
            where: {
                expiresAt: { lt: new Date() }
            }
        });

        return result.count;
    }

    /**
     * Get all active reservations for a session.
     */
    async getSessionReservations(sessionId: string) {
        return prisma.cartReservation.findMany({
            where: {
                sessionId,
                expiresAt: { gt: new Date() }
            },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        currentStock: true,
                        salePrice: true
                    }
                }
            }
        });
    }

    /**
     * Validate all reservations before checkout.
     * Returns any products that no longer have sufficient stock.
     */
    async validateReservationsForCheckout(
        sessionId: string
    ): Promise<{
        valid: boolean;
        invalidItems: Array<{
            productId: string;
            productName: string;
            reserved: number;
            available: number;
        }>;
    }> {
        const reservations = await this.getSessionReservations(sessionId);
        const invalidItems: Array<{
            productId: string;
            productName: string;
            reserved: number;
            available: number;
        }> = [];

        for (const reservation of reservations) {
            // Check if stock is still available (excluding this user's reservation)
            const otherReservations = await prisma.cartReservation.aggregate({
                where: {
                    productId: reservation.productId,
                    sessionId: { not: sessionId },
                    expiresAt: { gt: new Date() }
                },
                _sum: { quantity: true }
            });

            const otherReserved = otherReservations._sum.quantity || new Decimal(0);
            const effectiveAvailable = reservation.product.currentStock.minus(otherReserved);

            if (effectiveAvailable.lessThan(reservation.quantity)) {
                invalidItems.push({
                    productId: reservation.productId,
                    productName: reservation.product.name,
                    reserved: reservation.quantity.toNumber(),
                    available: effectiveAvailable.toNumber()
                });
            }
        }

        return {
            valid: invalidItems.length === 0,
            invalidItems
        };
    }
}

// Singleton instance
export const cartReservationService = new CartReservationService();
