/**
 * Safe Action Pattern - Higher-Order Function for Server Actions
 * 
 * Wraps async functions to provide:
 * - Standardized response format
 * - Centralized error handling
 * - Performance timing
 * - Debug logging (controlled by NEXT_PUBLIC_DEBUG_MODE)
 * - Client-safe error messages
 */

import { debugLogger } from './debug-logger';

/**
 * Standardized response format for all actions
 */
export interface SafeActionResponse<T = any> {
    success: boolean;
    data: T | null;
    error: string | null;
    meta?: {
        executionTime?: number;
        timestamp?: string;
        context?: string;
    };
}

/**
 * Configuration options for safe action
 */
interface SafeActionOptions {
    context?: string;
    logInput?: boolean;
    logOutput?: boolean;
}

/**
 * Safe Action Wrapper
 * 
 * Usage:
 * ```typescript
 * const myAction = safeAction(async (input: MyInput) => {
 *   // Your logic here
 *   return result;
 * }, { context: 'MyAction' });
 * ```
 * 
 * @param fn - The async function to wrap
 * @param options - Configuration options
 * @returns Wrapped function that returns SafeActionResponse
 */
export function safeAction<TInput = any, TOutput = any>(
    fn: (input: TInput) => Promise<TOutput>,
    options: SafeActionOptions = {}
) {
    const { context = 'SafeAction', logInput = true, logOutput = true } = options;

    return async (input: TInput): Promise<SafeActionResponse<TOutput>> => {
        const startTime = performance.now();
        const timestamp = new Date().toISOString();

        try {
            // Log action start (debug mode only)
            debugLogger.info(`Starting action`, context);

            if (logInput && debugLogger.isDebug()) {
                debugLogger.info('Input received', context, input);
            }

            // Execute the wrapped function
            const result = await fn(input);

            // Calculate execution time
            const executionTime = performance.now() - startTime;

            // Log success (debug mode only)
            debugLogger.success(
                `Action completed in ${executionTime.toFixed(2)}ms`,
                context
            );

            if (logOutput && debugLogger.isDebug()) {
                debugLogger.success('Output generated', context, result);
            }

            // Return standardized success response
            return {
                success: true,
                data: result,
                error: null,
                meta: {
                    executionTime,
                    timestamp,
                    context
                }
            };

        } catch (error: any) {
            // Calculate execution time even for errors
            const executionTime = performance.now() - startTime;

            // Log error (always logged, even in production)
            debugLogger.error(
                `Action failed after ${executionTime.toFixed(2)}ms`,
                context,
                error
            );

            // Get sanitized error message for client
            const clientError = debugLogger.getSanitizedError(error);

            // Return standardized error response
            return {
                success: false,
                data: null,
                error: clientError,
                meta: {
                    executionTime,
                    timestamp,
                    context
                }
            };
        }
    };
}

/**
 * Async version of safe action for use with FormData
 * Commonly used with Next.js Server Actions
 */
export function safeFormAction<TOutput = any>(
    fn: (formData: FormData) => Promise<TOutput>,
    options: SafeActionOptions = {}
) {
    return safeAction<FormData, TOutput>(fn, options);
}

/**
 * Safe action for API routes
 * Returns Response object instead of SafeActionResponse
 */
export async function safeApiAction<TInput = any, TOutput = any>(
    fn: (input: TInput) => Promise<TOutput>,
    input: TInput,
    options: SafeActionOptions = {}
): Promise<Response> {
    const result = await safeAction(fn, options)(input);

    if (result.success) {
        return Response.json(result.data, {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } else {
        // Determine appropriate HTTP status from error message
        const errorMsg = (result.error || '').toLowerCase();
        let status = 500;
        if (errorMsg.includes('no autorizado') || errorMsg.includes('unauthorized') || errorMsg.includes('not authenticated')) {
            status = 401;
        } else if (errorMsg.includes('no permitido') || errorMsg.includes('forbidden') || errorMsg.includes('permission')) {
            status = 403;
        } else if (errorMsg.includes('no encontrado') || errorMsg.includes('not found')) {
            status = 404;
        } else if (errorMsg.includes('validación') || errorMsg.includes('validation') || errorMsg.includes('inválido') || errorMsg.includes('invalid') || errorMsg.includes('requerido') || errorMsg.includes('required')) {
            status = 400;
        } else if (errorMsg.includes('rate limit') || errorMsg.includes('too many')) {
            status = 429;
        }

        return Response.json(
            { error: result.error },
            {
                status,
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
    }
}

/**
 * Utility to check if a response is successful
 */
export function isSuccess<T>(
    response: SafeActionResponse<T>
): response is SafeActionResponse<T> & { success: true; data: T } {
    return response.success === true && response.data !== null;
}

/**
 * Utility to handle response with type narrowing
 */
export async function handleSafeAction<T>(
    action: Promise<SafeActionResponse<T>>,
    callbacks: {
        onSuccess?: (data: T) => void | Promise<void>;
        onError?: (error: string) => void | Promise<void>;
    }
): Promise<void> {
    const response = await action;

    if (isSuccess(response)) {
        await callbacks.onSuccess?.(response.data);
    } else {
        await callbacks.onError?.(response.error || 'Error desconocido');
    }
}
