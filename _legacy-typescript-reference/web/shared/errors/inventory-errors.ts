/**
 * Custom error for optimistic concurrency control conflicts.
 * Thrown when a product's version has changed between read and write operations.
 */
export class ConcurrencyConflictError extends Error {
    public readonly productId?: string;
    public readonly expectedVersion?: number;
    public readonly actualVersion?: number;

    constructor(
        message: string,
        details?: {
            productId?: string;
            expectedVersion?: number;
            actualVersion?: number;
        }
    ) {
        super(message);
        this.name = 'ConcurrencyConflictError';
        this.productId = details?.productId;
        this.expectedVersion = details?.expectedVersion;
        this.actualVersion = details?.actualVersion;
    }
}

/**
 * Custom error for insufficient stock.
 * Thrown when trying to reserve or deduct more stock than available.
 */
export class InsufficientStockError extends Error {
    public readonly productId: string;
    public readonly requested: number;
    public readonly available: number;

    constructor(
        message: string,
        details: {
            productId: string;
            requested: number;
            available: number;
        }
    ) {
        super(message);
        this.name = 'InsufficientStockError';
        this.productId = details.productId;
        this.requested = details.requested;
        this.available = details.available;
    }
}

/**
 * Custom error for cart reservation expiration.
 */
export class ReservationExpiredError extends Error {
    public readonly reservationId: string;

    constructor(message: string, reservationId: string) {
        super(message);
        this.name = 'ReservationExpiredError';
        this.reservationId = reservationId;
    }
}
