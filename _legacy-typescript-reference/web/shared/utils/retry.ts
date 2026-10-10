import { ConcurrencyConflictError } from '@/shared/errors/inventory-errors';

interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 2000,
};

/**
 * Retry an async operation with exponential backoff.
 * Specifically designed for handling ConcurrencyConflictError in OCC scenarios.
 * 
 * @param operation - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const config = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            // Only retry on ConcurrencyConflictError
            if (!(error instanceof ConcurrencyConflictError)) {
                throw error;
            }

            // If we've exhausted all retries
            if (attempt > config.maxRetries) {
                console.error(
                    `[Retry] Exhausted ${config.maxRetries} retries for operation`,
                    { error: lastError.message }
                );
                throw error;
            }

            // Calculate delay with exponential backoff + jitter
            const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt - 1);
            const jitter = Math.random() * config.baseDelayMs;
            const delay = Math.min(exponentialDelay + jitter, config.maxDelayMs);

            console.warn(
                `[Retry] Attempt ${attempt}/${config.maxRetries} failed with ConcurrencyConflictError. Retrying in ${delay.toFixed(0)}ms...`,
                {
                    productId: (error as ConcurrencyConflictError).productId,
                    expectedVersion: (error as ConcurrencyConflictError).expectedVersion,
                }
            );

            // Notify callback if provided
            options.onRetry?.(attempt, error as Error);

            // Wait before retry
            await sleep(delay);
        }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError;
}

/**
 * Helper to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Decorator-style wrapper for methods that should retry on concurrency conflicts.
 * 
 * @example
 * const result = await retryOnConflict(() => 
 *   inventoryRepository.reserveStockWithOCC(productId, quantity, refId, refType)
 * );
 */
export const retryOnConflict = <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> => withRetry(operation, { maxRetries });
