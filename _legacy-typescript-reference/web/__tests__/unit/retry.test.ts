import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { withRetry, retryOnConflict } from '@/shared/utils/retry';
import { ConcurrencyConflictError, InsufficientStockError } from '@/shared/errors/inventory-errors';

describe('Retry Utility', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('withRetry', () => {
        it('should return result on first successful attempt', async () => {
            const operation = jest.fn<any>().mockResolvedValue('success');

            const result = await withRetry(operation);

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should retry on ConcurrencyConflictError', async () => {
            const operation = jest.fn<any>()
                .mockRejectedValueOnce(new ConcurrencyConflictError('Conflict'))
                .mockResolvedValue('success after retry');

            const promise = withRetry(operation);

            // Advance timers to allow retry delay
            await jest.runAllTimersAsync();

            const result = await promise;

            expect(result).toBe('success after retry');
            expect(operation).toHaveBeenCalledTimes(2);
        });

        it('should NOT retry on other errors', async () => {
            const otherError = new Error('Database connection error');
            const operation = jest.fn<any>().mockRejectedValue(otherError);

            await expect(withRetry(operation)).rejects.toThrow('Database connection error');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should NOT retry on InsufficientStockError', async () => {
            const stockError = new InsufficientStockError('No stock', {
                productId: 'prod-1',
                requested: 10,
                available: 5
            });
            const operation = jest.fn<any>().mockRejectedValue(stockError);

            await expect(withRetry(operation)).rejects.toThrow('No stock');
            expect(operation).toHaveBeenCalledTimes(1);
        });

        it('should exhaust retries and throw last error', async () => {
            const conflictError = new ConcurrencyConflictError('Persistent conflict', {
                productId: 'prod-1',
                expectedVersion: 5
            });
            const operation = jest.fn<any>().mockRejectedValue(conflictError);

            const promise = withRetry(operation, { maxRetries: 3 });
            // Adjuntar el handler ANTES de avanzar los timers: si la promesa
            // rechaza sin handler, jest 30 lo reporta como unhandled rejection.
            const assertion = expect(promise).rejects.toThrow('Persistent conflict');

            // Advance through all retries
            await jest.runAllTimersAsync();

            await assertion;
            expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
        });

        it('should call onRetry callback on each retry', async () => {
            const onRetry = jest.fn<any>();
            const operation = jest.fn<any>()
                .mockRejectedValueOnce(new ConcurrencyConflictError('Conflict 1'))
                .mockRejectedValueOnce(new ConcurrencyConflictError('Conflict 2'))
                .mockResolvedValue('success');

            const promise = withRetry(operation, { maxRetries: 3, onRetry });
            await jest.runAllTimersAsync();
            await promise;

            expect(onRetry).toHaveBeenCalledTimes(2);
            expect(onRetry).toHaveBeenCalledWith(1, expect.any(ConcurrencyConflictError));
            expect(onRetry).toHaveBeenCalledWith(2, expect.any(ConcurrencyConflictError));
        });

        it('should respect maxRetries configuration', async () => {
            const operation = jest.fn<any>()
                .mockRejectedValue(new ConcurrencyConflictError('Conflict'));

            const promise = withRetry(operation, { maxRetries: 1 });
            const assertion = expect(promise).rejects.toThrow();
            await jest.runAllTimersAsync();

            await assertion;
            expect(operation).toHaveBeenCalledTimes(2); // Initial + 1 retry
        });
    });

    describe('retryOnConflict', () => {
        it('should be a shorthand for withRetry', async () => {
            const operation = jest.fn<any>().mockResolvedValue('result');

            const result = await retryOnConflict(operation, 2);

            expect(result).toBe('result');
            expect(operation).toHaveBeenCalledTimes(1);
        });
    });
});
