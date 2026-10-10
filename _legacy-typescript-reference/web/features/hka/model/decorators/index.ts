/**
 * Decorator Patterns - Higher-Order Functions
 * 
 * Provides decorators for adding cross-cutting concerns like
 * logging, retry logic, and metrics without modifying core code.
 * 
 * @module lib/features/hka/decorators
 */

import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('Decorators');

// ============================================
// TYPES
// ============================================

/**
 * Generic async function type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AsyncFn<TArgs extends any[] = any[], TReturn = any> = (
    ...args: TArgs
) => Promise<TReturn>;

/**
 * Logging options
 */
export interface LoggingOptions {
    /** Name to identify this operation in logs */
    name: string;
    /** Log level for input args */
    level?: 'info' | 'debug' | 'trace';
    /** Whether to log input args (may contain sensitive data) */
    logArgs?: boolean;
    /** Whether to log result */
    logResult?: boolean;
}

/**
 * Retry options
 */
export interface RetryOptions {
    /** Maximum number of retry attempts */
    maxRetries: number;
    /** Backoff strategy */
    backoff: 'exponential' | 'linear' | 'constant';
    /** Base delay in milliseconds */
    baseDelayMs?: number;
    /** Maximum delay in milliseconds */
    maxDelayMs?: number;
    /** Optional function to determine if error is retryable */
    isRetryable?: (error: unknown) => boolean;
    /** Callback when a retry occurs */
    onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Metrics options
 */
export interface MetricsOptions {
    /** Operation name for metrics */
    operation: string;
    /** Additional tags */
    tags?: Record<string, string>;
}

/**
 * Timeout options
 */
export interface TimeoutOptions {
    /** Timeout in milliseconds */
    timeoutMs: number;
    /** Error message on timeout */
    timeoutMessage?: string;
}

// ============================================
// LOGGING DECORATOR
// ============================================

/**
 * Decorator that adds logging to an async function
 * 
 * @example
 * ```typescript
 * const loggedFetch = withLogging(fetch, { name: 'HTTP Fetch' });
 * await loggedFetch('https://api.example.com');
 * // Logs: [HTTP Fetch] Starting
 * // Logs: [HTTP Fetch] Completed in 150ms
 * ```
 */
export function withLogging<TArgs extends unknown[], TReturn>(
    fn: AsyncFn<TArgs, TReturn>,
    options: LoggingOptions
): AsyncFn<TArgs, TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
        const start = performance.now();
        const { name, level = 'info', logArgs = false, logResult = false } = options;

        logger[level]({
            operation: name,
            ...(logArgs && { args }),
        }, `[${name}] Starting`);

        try {
            const result = await fn(...args);
            const duration = Math.round(performance.now() - start);

            logger[level]({
                operation: name,
                durationMs: duration,
                ...(logResult && { result }),
            }, `[${name}] Completed in ${duration}ms`);

            return result;
        } catch (error) {
            const duration = Math.round(performance.now() - start);

            logger.error({
                operation: name,
                durationMs: duration,
                error: error instanceof Error ? error.message : String(error),
            }, `[${name}] Failed after ${duration}ms`);

            throw error;
        }
    };
}

// ============================================
// RETRY DECORATOR
// ============================================

/**
 * Default function to check if an error is retryable
 */
function defaultIsRetryable(error: unknown): boolean {
    if (error instanceof Error) {
        // Network errors are retryable
        const message = error.message.toLowerCase();
        if (
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('econnreset') ||
            message.includes('econnrefused') ||
            message.includes('socket')
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Calculate delay based on backoff strategy
 */
function calculateDelay(
    attempt: number,
    options: RetryOptions
): number {
    const baseDelay = options.baseDelayMs ?? 1000;
    const maxDelay = options.maxDelayMs ?? 30000;

    let delay: number;

    switch (options.backoff) {
        case 'exponential':
            delay = baseDelay * Math.pow(2, attempt);
            break;
        case 'linear':
            delay = baseDelay * (attempt + 1);
            break;
        case 'constant':
        default:
            delay = baseDelay;
            break;
    }

    // Add jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    delay = Math.round(delay + jitter);

    return Math.min(delay, maxDelay);
}

/**
 * Decorator that adds retry logic to an async function
 * 
 * @example
 * ```typescript
 * const resilientCall = withRetry(apiCall, { 
 *   maxRetries: 3, 
 *   backoff: 'exponential' 
 * });
 * await resilientCall(data);
 * // Will retry up to 3 times on failure with exponential backoff
 * ```
 */
export function withRetry<TArgs extends unknown[], TReturn>(
    fn: AsyncFn<TArgs, TReturn>,
    options: RetryOptions
): AsyncFn<TArgs, TReturn> {
    const isRetryable = options.isRetryable ?? defaultIsRetryable;

    return async (...args: TArgs): Promise<TReturn> => {
        let lastError: unknown;

        for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
            try {
                return await fn(...args);
            } catch (error) {
                lastError = error;

                // Check if we should retry
                if (attempt < options.maxRetries && isRetryable(error)) {
                    const delay = calculateDelay(attempt, options);

                    logger.warn({
                        attempt: attempt + 1,
                        maxRetries: options.maxRetries,
                        delayMs: delay,
                        error: error instanceof Error ? error.message : String(error),
                    }, `Retry attempt ${attempt + 1}/${options.maxRetries} after ${delay}ms`);

                    options.onRetry?.(attempt + 1, error);

                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // Not retryable or max retries reached
                    throw error;
                }
            }
        }

        throw lastError;
    };
}

// ============================================
// TIMEOUT DECORATOR
// ============================================

/**
 * Decorator that adds timeout to an async function
 * 
 * @example
 * ```typescript
 * const timedCall = withTimeout(longRunningFn, { 
 *   timeoutMs: 5000,
 *   timeoutMessage: 'Operation timed out'
 * });
 * ```
 */
export function withTimeout<TArgs extends unknown[], TReturn>(
    fn: AsyncFn<TArgs, TReturn>,
    options: TimeoutOptions
): AsyncFn<TArgs, TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(
                () => reject(new Error(options.timeoutMessage ?? `Operation timed out after ${options.timeoutMs}ms`)),
                options.timeoutMs
            );
        });

        return Promise.race([fn(...args), timeoutPromise]);
    };
}

// ============================================
// METRICS DECORATOR
// ============================================

/**
 * Simple in-memory metrics collector 
 * In production, this would send to a metrics service
 */
const metrics = {
    counters: new Map<string, number>(),
    histograms: new Map<string, number[]>(),

    increment(name: string, tags?: Record<string, string>): void {
        const key = this.buildKey(name, tags);
        this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
    },

    recordDuration(name: string, durationMs: number, tags?: Record<string, string>): void {
        const key = this.buildKey(name, tags);
        const values = this.histograms.get(key) ?? [];
        values.push(durationMs);
        this.histograms.set(key, values);
    },

    buildKey(name: string, tags?: Record<string, string>): string {
        if (!tags) return name;
        const tagStr = Object.entries(tags)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join(',');
        return `${name}{${tagStr}}`;
    },

    getStats(): { counters: Record<string, number>; histograms: Record<string, { count: number; avg: number; p95: number }> } {
        const counters: Record<string, number> = {};
        const histograms: Record<string, { count: number; avg: number; p95: number }> = {};

        this.counters.forEach((v, k) => { counters[k] = v; });

        this.histograms.forEach((values, key) => {
            const sorted = values.slice().sort((a, b) => a - b);
            const count = sorted.length;
            const avg = sorted.reduce((a, b) => a + b, 0) / count;
            const p95Index = Math.floor(count * 0.95);
            const p95 = sorted[p95Index] ?? 0;
            histograms[key] = { count, avg: Math.round(avg), p95: Math.round(p95) };
        });

        return { counters, histograms };
    },

    reset(): void {
        this.counters.clear();
        this.histograms.clear();
    },
};

/**
 * Decorator that adds metrics collection to an async function
 * 
 * @example
 * ```typescript
 * const measuredCall = withMetrics(apiCall, { 
 *   operation: 'hka_emit',
 *   tags: { environment: 'prod' }
 * });
 * ```
 */
export function withMetrics<TArgs extends unknown[], TReturn>(
    fn: AsyncFn<TArgs, TReturn>,
    options: MetricsOptions
): AsyncFn<TArgs, TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
        const start = performance.now();

        try {
            const result = await fn(...args);
            const duration = performance.now() - start;

            metrics.increment(`${options.operation}.success`, options.tags);
            metrics.recordDuration(`${options.operation}.duration`, duration, options.tags);

            return result;
        } catch (error) {
            const duration = performance.now() - start;

            metrics.increment(`${options.operation}.error`, options.tags);
            metrics.recordDuration(`${options.operation}.duration`, duration, options.tags);

            throw error;
        }
    };
}

// ============================================
// COMPOSITION HELPER
// ============================================

/**
 * Compose multiple decorators together (left to right)
 * 
 * @example
 * ```typescript
 * const enhancedCall = pipe(
 *   apiCall,
 *   fn => withLogging(fn, { name: 'API Call' }),
 *   fn => withRetry(fn, { maxRetries: 3, backoff: 'exponential' }),
 *   fn => withMetrics(fn, { operation: 'api_call' })
 * );
 * ```
 */
export function pipe<T>(
    initial: T,
    ...fns: Array<(arg: T) => T>
): T {
    return fns.reduce((acc, fn) => fn(acc), initial);
}

/**
 * Create a fully observable function with logging, retry, timeout, and metrics
 */
export function withObservability<TArgs extends unknown[], TReturn>(
    fn: AsyncFn<TArgs, TReturn>,
    options: {
        name: string;
        operation?: string;
        retry?: Omit<RetryOptions, 'onRetry'>;
        timeoutMs?: number;
        tags?: Record<string, string>;
    }
): AsyncFn<TArgs, TReturn> {
    let result = fn;

    // Apply timeout first (innermost)
    if (options.timeoutMs) {
        result = withTimeout(result, {
            timeoutMs: options.timeoutMs,
            timeoutMessage: `${options.name} timed out after ${options.timeoutMs}ms`,
        });
    }

    // Apply retry
    if (options.retry) {
        result = withRetry(result, {
            ...options.retry,
            onRetry: (attempt, error) => {
                logger.warn({ operation: options.name, attempt, error }, `Retrying ${options.name}`);
            },
        });
    }

    // Apply metrics
    result = withMetrics(result, {
        operation: options.operation ?? options.name.toLowerCase().replace(/\s+/g, '_'),
        tags: options.tags,
    });

    // Apply logging (outermost)
    result = withLogging(result, {
        name: options.name,
        level: 'info',
    });

    return result;
}

// ============================================
// EXPORTS
// ============================================

export { metrics as metricsCollector };

export const Decorators = {
    withLogging,
    withRetry,
    withTimeout,
    withMetrics,
    withObservability,
    pipe,
};
