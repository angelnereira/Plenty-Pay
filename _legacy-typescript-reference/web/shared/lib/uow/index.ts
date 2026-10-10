/**
 * Unit of Work Pattern
 * 
 * Coordinates multiple repository operations within a single transaction.
 * Provides atomic operations and automatic rollback on failure.
 * 
 * @module lib/shared/uow
 */

import { PrismaClient } from '@prisma/client';
import { prisma } from '@core/database';

// The prisma instance uses extensions (Accelerate + pagination) which produce a
// DynamicClientExtensionThis — different from the base PrismaClient type.
// We derive types from the actual instance to guarantee compatibility.
type ExtendedPrismaClient = typeof prisma;

// Type-safe transaction client extracted from the extended Prisma client signature
type PrismaTransactionClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0];
import {
    Ok,
    Err,
    type AsyncServiceResult,
    DatabaseError,
} from '@shared/lib/result';

// ============================================
// TYPES
// ============================================

/**
 * Transaction context passed to repositories.
 * Uses Prisma's own internal transaction client type for full type safety.
 */
export type TransactionClient = PrismaTransactionClient;

/**
 * Unit of Work options
 */
export interface UnitOfWorkOptions {
    /** Transaction isolation level */
    isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
    /** Timeout in milliseconds */
    timeout?: number;
    /** Maximum retry attempts on serialization errors */
    maxRetries?: number;
}

/**
 * Work function that receives transaction context
 */
export type WorkFunction<T> = (tx: TransactionClient) => Promise<T>;

// ============================================
// UNIT OF WORK CLASS
// ============================================

/**
 * Unit of Work for coordinating transactional operations
 * 
 * @example
 * ```typescript
 * // Using default prisma client
 * const uow = new UnitOfWork();
 * 
 * // With injected client (for testing)
 * const uow = new UnitOfWork({ client: mockPrisma });
 * 
 * const result = await uow.execute(async (tx) => {
 *   const invoice = await tx.invoice.create({ data: invoiceData });
 *   await tx.invoiceItem.createMany({ data: items });
 *   return invoice;
 * });
 * 
 * if (result.ok) {
 *   console.log('All saved:', result.value.id);
 * }
 * ```
 */
export class UnitOfWork {
    private options: Required<UnitOfWorkOptions>;
    private client: ExtendedPrismaClient;

    constructor(options: UnitOfWorkOptions & { client?: ExtendedPrismaClient } = {}) {
        this.client = options.client ?? prisma;
        this.options = {
            isolationLevel: options.isolationLevel ?? 'ReadCommitted',
            timeout: options.timeout ?? 10000,
            maxRetries: options.maxRetries ?? 3,
        };
    }

    /**
     * Execute work within a transaction
     */
    async execute<T>(work: WorkFunction<T>): AsyncServiceResult<T> {
        let attempts = 0;

        while (attempts < this.options.maxRetries) {
            attempts++;

            try {
                const result = await this.client.$transaction(
                    async (tx: TransactionClient) => {
                        return await work(tx);
                    },
                    {
                        isolationLevel: this.options.isolationLevel,
                        timeout: this.options.timeout,
                    }
                );

                return Ok(result);
            } catch (error) {
                // Check if it's a serialization error that can be retried
                if (this.isSerializationError(error) && attempts < this.options.maxRetries) {
                    // Wait before retry with exponential backoff
                    await this.delay(Math.pow(2, attempts) * 100);
                    continue;
                }

                return Err(new DatabaseError(
                    'transaction',
                    error instanceof Error ? error.message : 'Unknown transaction error'
                ));
            }
        }

        return Err(new DatabaseError(
            'transaction',
            `Transaction failed after ${this.options.maxRetries} attempts`
        ));
    }

    /**
     * Execute work with custom options
     */
    async executeWith<T>(
        work: WorkFunction<T>,
        options: Partial<UnitOfWorkOptions>
    ): AsyncServiceResult<T> {
        const uow = new UnitOfWork({ ...this.options, ...options });
        return uow.execute(work);
    }

    /**
     * Check if error is a serialization/deadlock error
     */
    private isSerializationError(error: unknown): boolean {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (
                message.includes('serialization') ||
                message.includes('deadlock') ||
                message.includes('could not serialize') ||
                message.includes('concurrent update')
            );
        }
        return false;
    }

    /**
     * Delay helper
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Execute work in a transaction with default options
 */
export async function transaction<T>(
    work: WorkFunction<T>
): AsyncServiceResult<T> {
    const uow = new UnitOfWork();
    return uow.execute(work);
}

/**
 * Execute work in a serializable transaction
 * Use for critical operations requiring highest isolation
 */
export async function serializable<T>(
    work: WorkFunction<T>
): AsyncServiceResult<T> {
    const uow = new UnitOfWork({ isolationLevel: 'Serializable' });
    return uow.execute(work);
}

// ============================================
// REPOSITORY BASE WITH UOW SUPPORT
// ============================================

/**
 * Base class for repositories that support Unit of Work
 */
export abstract class TransactionalRepository<T> {
    protected prisma: ExtendedPrismaClient | TransactionClient;

    constructor(tx?: TransactionClient) {
        this.prisma = tx ?? prisma;
    }

    /**
     * Create a new instance with transaction context
     */
    abstract withTransaction(tx: TransactionClient): this;
}

// ============================================
// AGGREGATE OPERATIONS
// ============================================

/**
 * Helper for creating related entities atomically
 */
export interface AggregateCreateInput<TParent, TChild> {
    parent: TParent;
    children: TChild[];
}

/**
 * Create parent with children in single transaction
 */
export async function createAggregate<TParent, TChild, TResult>(
    createParent: (tx: TransactionClient, parent: TParent) => Promise<TResult>,
    createChildren: (tx: TransactionClient, parentId: string, children: TChild[]) => Promise<void>,
    input: AggregateCreateInput<TParent, TChild>,
    getParentId: (result: TResult) => string
): AsyncServiceResult<TResult> {
    return transaction(async (tx) => {
        const parent = await createParent(tx, input.parent);
        const parentId = getParentId(parent);

        if (input.children.length > 0) {
            await createChildren(tx, parentId, input.children);
        }

        return parent;
    });
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Execute multiple operations in batches within a transaction
 */
export async function batchInTransaction<T, R>(
    items: T[],
    batchSize: number,
    operation: (tx: TransactionClient, batch: T[]) => Promise<R[]>
): AsyncServiceResult<R[]> {
    return transaction(async (tx) => {
        const results: R[] = [];

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await operation(tx, batch);
            results.push(...batchResults);
        }

        return results;
    });
}
