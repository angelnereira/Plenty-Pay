/**
 * Result Pattern - Type-safe Error Handling
 * 
 * Provides explicit success/error types for better error handling
 * without relying on exceptions.
 * 
 * @example
 * ```typescript
 * // In a service
 * async function getUser(id: string): Promise<Result<User, NotFoundError>> {
 *   const user = await repo.findById(id);
 *   if (!user) return Err(new NotFoundError('User not found'));
 *   return Ok(user);
 * }
 * 
 * // In caller
 * const result = await getUser(id);
 * if (result.ok) {
 *   console.log(result.value.name);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */

// ============================================
// CORE TYPES
// ============================================

/**
 * Success result type
 */
export interface OkResult<T> {
    readonly ok: true;
    readonly value: T;
}

/**
 * Error result type
 */
export interface ErrResult<E> {
    readonly ok: false;
    readonly error: E;
}

/**
 * Result type - either success with value or failure with error
 */
export type Result<T, E = Error> = OkResult<T> | ErrResult<E>;

// ============================================
// CONSTRUCTORS
// ============================================

/**
 * Create a success result
 */
export function Ok<T>(value: T): OkResult<T> {
    return { ok: true, value };
}

/**
 * Create an error result
 */
export function Err<E>(error: E): ErrResult<E> {
    return { ok: false, error };
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if result is success
 */
export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
    return result.ok === true;
}

/**
 * Check if result is error
 */
export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
    return result.ok === false;
}

// ============================================
// TRANSFORMATIONS
// ============================================

/**
 * Transform the success value
 */
export function map<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U
): Result<U, E> {
    if (isOk(result)) {
        return Ok(fn(result.value));
    }
    return result;
}

/**
 * Transform the error value
 */
export function mapErr<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => F
): Result<T, F> {
    if (isErr(result)) {
        return Err(fn(result.error));
    }
    return result;
}

/**
 * Chain operations that return Results
 */
export function flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
): Result<U, E> {
    if (isOk(result)) {
        return fn(result.value);
    }
    return result;
}

/**
 * Chain async operations that return Results
 */
export async function flatMapAsync<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
    if (isOk(result)) {
        return fn(result.value);
    }
    return result;
}

// ============================================
// EXTRACTORS
// ============================================

/**
 * Get value or default
 */
export function getOrElse<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (isOk(result)) {
        return result.value;
    }
    return defaultValue;
}

/**
 * Get value or compute default from error
 */
export function getOrElseWith<T, E>(
    result: Result<T, E>,
    fn: (error: E) => T
): T {
    if (isOk(result)) {
        return result.value;
    }
    return fn(result.error);
}

/**
 * Unwrap value or throw error
 * @throws Error if result is Err
 */
export function unwrap<T, E>(result: Result<T, E>): T {
    if (isOk(result)) {
        return result.value;
    }
    throw result.error;
}

/**
 * Unwrap error or throw if Ok
 * @throws Error if result is Ok
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
    if (isErr(result)) {
        return result.error;
    }
    throw new Error('Called unwrapErr on Ok result');
}

// ============================================
// COMBINATORS
// ============================================

/**
 * Combine multiple results into one
 * Returns Err if any result is Err, Ok with array if all are Ok
 */
export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
        if (isErr(result)) {
            return result;
        }
        values.push(result.value);
    }
    return Ok(values);
}

/**
 * Return first Ok result or last Err
 */
export function any<T, E>(results: Result<T, E>[]): Result<T, E> {
    let lastErr: ErrResult<E> | null = null;
    for (const result of results) {
        if (isOk(result)) {
            return result;
        }
        lastErr = result;
    }
    if (lastErr) {
        return lastErr;
    }
    return Err(new Error('No results provided') as unknown as E);
}

// ============================================
// ASYNC HELPERS
// ============================================

/**
 * Convert a Promise that might throw into a Result
 */
export async function fromPromise<T, E = Error>(
    promise: Promise<T>,
    errorTransform?: (error: unknown) => E
): Promise<Result<T, E>> {
    try {
        const value = await promise;
        return Ok(value);
    } catch (error) {
        if (errorTransform) {
            return Err(errorTransform(error));
        }
        return Err(error as E);
    }
}

/**
 * Convert a function that might throw into a Result
 */
export function fromTry<T, E = Error>(
    fn: () => T,
    errorTransform?: (error: unknown) => E
): Result<T, E> {
    try {
        const value = fn();
        return Ok(value);
    } catch (error) {
        if (errorTransform) {
            return Err(errorTransform(error));
        }
        return Err(error as E);
    }
}

/**
 * Apply a function to a Result value, running side effects
 */
export function tap<T, E>(
    result: Result<T, E>,
    fn: (value: T) => void
): Result<T, E> {
    if (isOk(result)) {
        fn(result.value);
    }
    return result;
}

/**
 * Apply a function to a Result error, running side effects
 */
export function tapErr<T, E>(
    result: Result<T, E>,
    fn: (error: E) => void
): Result<T, E> {
    if (isErr(result)) {
        fn(result.error);
    }
    return result;
}

// ============================================
// PATTERN MATCHING
// ============================================

/**
 * Pattern match on a Result
 */
export function match<T, E, U>(
    result: Result<T, E>,
    handlers: {
        ok: (value: T) => U;
        err: (error: E) => U;
    }
): U {
    if (isOk(result)) {
        return handlers.ok(result.value);
    }
    return handlers.err(result.error);
}

/**
 * Async pattern match on a Result
 */
export async function matchAsync<T, E, U>(
    result: Result<T, E>,
    handlers: {
        ok: (value: T) => Promise<U>;
        err: (error: E) => Promise<U>;
    }
): Promise<U> {
    if (isOk(result)) {
        return handlers.ok(result.value);
    }
    return handlers.err(result.error);
}

// ============================================
// COMMON ERROR TYPES
// ============================================

/**
 * Base error class for domain errors
 */
export class DomainError extends Error {
    readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
    }
}

/**
 * Entity not found error
 */
export class NotFoundError extends DomainError {
    readonly entityType: string;
    readonly entityId: string;

    constructor(entityType: string, entityId: string) {
        super(`${entityType} with id '${entityId}' not found`, 'NOT_FOUND');
        this.entityType = entityType;
        this.entityId = entityId;
    }
}

/**
 * Validation error
 */
export class ValidationError extends DomainError {
    readonly field: string;
    readonly details: string[];

    constructor(field: string, details: string | string[]) {
        const detailsArray = Array.isArray(details) ? details : [details];
        super(`Validation failed for ${field}: ${detailsArray.join(', ')}`, 'VALIDATION_ERROR');
        this.field = field;
        this.details = detailsArray;
    }
}

/**
 * Authorization error
 */
export class UnauthorizedError extends DomainError {
    constructor(message = 'Not authorized') {
        super(message, 'UNAUTHORIZED');
    }
}

/**
 * Database operation error
 */
export class DatabaseError extends DomainError {
    readonly operation: string;

    constructor(operation: string, message: string) {
        super(`Database ${operation} failed: ${message}`, 'DATABASE_ERROR');
        this.operation = operation;
    }
}

/**
 * External service error (e.g., HKA)
 */
export class ExternalServiceError extends DomainError {
    readonly service: string;
    readonly statusCode?: string;

    constructor(service: string, message: string, statusCode?: string) {
        super(`${service} error: ${message}`, 'EXTERNAL_SERVICE_ERROR');
        this.service = service;
        this.statusCode = statusCode;
    }
}

/**
 * Configuration error
 */
export class ConfigurationError extends DomainError {
    readonly configKey: string;

    constructor(configKey: string, message: string) {
        super(`Configuration error for '${configKey}': ${message}`, 'CONFIGURATION_ERROR');
        this.configKey = configKey;
    }
}

// ============================================
// TYPE HELPERS FOR SERVICES
// ============================================

/**
 * Service result type - common return type for service methods
 */
export type ServiceResult<T> = Result<T, DomainError>;

/**
 * Async service result type
 */
export type AsyncServiceResult<T> = Promise<ServiceResult<T>>;
