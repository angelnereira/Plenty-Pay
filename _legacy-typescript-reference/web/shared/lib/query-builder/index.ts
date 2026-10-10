/**
 * Query Builder Pattern
 * 
 * Fluent API for building type-safe database queries.
 * Wraps Prisma with a more readable interface.
 * 
 * @module lib/shared/query-builder
 */

// ============================================
// TYPES
// ============================================

/**
 * Sort order
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Pagination options
 */
export interface PaginationOptions {
    page: number;
    perPage: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        perPage: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

/**
 * Cursor pagination options
 */
export interface CursorPaginationOptions {
    cursor?: string;
    take: number;
    direction?: 'forward' | 'backward';
}

/**
 * Cursor paginated result
 */
export interface CursorPaginatedResult<T> {
    data: T[];
    meta: {
        cursor: string | null;
        hasMore: boolean;
    };
}

/**
 * Where condition operators
 */
export interface WhereConditions<T> {
    equals?: T;
    not?: T;
    in?: T[];
    notIn?: T[];
    lt?: T;
    lte?: T;
    gt?: T;
    gte?: T;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    mode?: 'default' | 'insensitive';
}

// ============================================
// QUERY BUILDER
// ============================================

/**
 * Generic Query Builder
 * 
 * @example
 * ```typescript
 * const result = await new QueryBuilder(prisma.invoice)
 *   .select(['id', 'invoiceNumber', 'totalAmount', 'status'])
 *   .where({ clientId })
 *   .whereIn('status', ['CERTIFIED', 'SENT'])
 *   .whereBetween('createdAt', startDate, endDate)
 *   .orderBy('createdAt', 'desc')
 *   .paginate({ page: 1, perPage: 20 })
 *   .execute();
 * ```
 */
export class QueryBuilder<T, TSelect = T> {
    private _where: Record<string, unknown> = {};
    private _orderBy: Array<Record<string, SortOrder>> = [];
    private _select: Record<string, boolean> | null = null;
    private _include: Record<string, boolean | object> | null = null;
    private _pagination: PaginationOptions | null = null;
    private _cursorPagination: CursorPaginationOptions | null = null;
    private _take: number | null = null;
    private _skip: number | null = null;

    constructor(
        private model: {
            findMany: (args: unknown) => Promise<T[]>;
            count: (args: unknown) => Promise<number>;
        }
    ) { }

    /**
     * Select specific fields
     */
    select<K extends keyof T>(fields: K[]): QueryBuilder<T, Pick<T, K>> {
        this._select = fields.reduce((acc, field) => {
            acc[field as string] = true;
            return acc;
        }, {} as Record<string, boolean>);
        return this as unknown as QueryBuilder<T, Pick<T, K>>;
    }

    /**
     * Include related entities
     */
    include(relations: Record<string, boolean | object>): this {
        this._include = { ...this._include, ...relations };
        return this;
    }

    /**
     * Add where conditions
     */
    where(conditions: Partial<Record<keyof T, unknown>>): this {
        this._where = { ...this._where, ...conditions };
        return this;
    }

    /**
     * Add where equals condition
     */
    whereEquals<K extends keyof T>(field: K, value: T[K]): this {
        this._where[field as string] = value;
        return this;
    }

    /**
     * Add where not equals condition
     */
    whereNot<K extends keyof T>(field: K, value: T[K]): this {
        this._where[field as string] = { not: value };
        return this;
    }

    /**
     * Add where in condition
     */
    whereIn<K extends keyof T>(field: K, values: T[K][]): this {
        this._where[field as string] = { in: values };
        return this;
    }

    /**
     * Add where not in condition
     */
    whereNotIn<K extends keyof T>(field: K, values: T[K][]): this {
        this._where[field as string] = { notIn: values };
        return this;
    }

    /**
     * Add where between condition (for dates/numbers)
     */
    whereBetween<K extends keyof T>(field: K, from: T[K], to: T[K]): this {
        this._where[field as string] = { gte: from, lte: to };
        return this;
    }

    /**
     * Add where greater than condition
     */
    whereGt<K extends keyof T>(field: K, value: T[K]): this {
        this._where[field as string] = { gt: value };
        return this;
    }

    /**
     * Add where greater than or equal condition
     */
    whereGte<K extends keyof T>(field: K, value: T[K]): this {
        this._where[field as string] = { gte: value };
        return this;
    }

    /**
     * Add where less than condition
     */
    whereLt<K extends keyof T>(field: K, value: T[K]): this {
        this._where[field as string] = { lt: value };
        return this;
    }

    /**
     * Add where less than or equal condition
     */
    whereLte<K extends keyof T>(field: K, value: T[K]): this {
        this._where[field as string] = { lte: value };
        return this;
    }

    /**
     * Add where contains condition (case insensitive)
     */
    whereContains(field: keyof T, value: string): this {
        this._where[field as string] = { contains: value, mode: 'insensitive' };
        return this;
    }

    /**
     * Add where starts with condition
     */
    whereStartsWith(field: keyof T, value: string): this {
        this._where[field as string] = { startsWith: value, mode: 'insensitive' };
        return this;
    }

    /**
     * Add where null condition
     */
    whereNull(field: keyof T): this {
        this._where[field as string] = null;
        return this;
    }

    /**
     * Add where not null condition
     */
    whereNotNull(field: keyof T): this {
        this._where[field as string] = { not: null };
        return this;
    }

    /**
     * Add OR conditions
     */
    orWhere(conditions: Array<Partial<Record<keyof T, unknown>>>): this {
        this._where = {
            ...this._where,
            OR: conditions,
        };
        return this;
    }

    /**
     * Add AND conditions
     */
    andWhere(conditions: Array<Partial<Record<keyof T, unknown>>>): this {
        this._where = {
            ...this._where,
            AND: conditions,
        };
        return this;
    }

    /**
     * Order by field
     */
    orderBy(field: keyof T, direction: SortOrder = 'asc'): this {
        this._orderBy.push({ [field as string]: direction });
        return this;
    }

    /**
     * Order by multiple fields
     */
    orderByMultiple(orders: Array<{ field: keyof T; direction: SortOrder }>): this {
        orders.forEach(({ field, direction }) => {
            this._orderBy.push({ [field as string]: direction });
        });
        return this;
    }

    /**
     * Take N records
     */
    take(count: number): this {
        this._take = count;
        return this;
    }

    /**
     * Skip N records
     */
    skip(count: number): this {
        this._skip = count;
        return this;
    }

    /**
     * Enable offset pagination
     */
    paginate(options: PaginationOptions): this {
        this._pagination = options;
        return this;
    }

    /**
     * Enable cursor pagination
     */
    cursorPaginate(options: CursorPaginationOptions): this {
        this._cursorPagination = options;
        return this;
    }

    /**
     * Build the query args
     */
    private buildArgs(): Record<string, unknown> {
        const args: Record<string, unknown> = {};

        if (Object.keys(this._where).length > 0) {
            args.where = this._where;
        }

        if (this._orderBy.length > 0) {
            args.orderBy = this._orderBy;
        }

        if (this._select) {
            args.select = this._select;
        }

        if (this._include) {
            args.include = this._include;
        }

        if (this._pagination) {
            args.skip = (this._pagination.page - 1) * this._pagination.perPage;
            args.take = this._pagination.perPage;
        } else if (this._cursorPagination) {
            if (this._cursorPagination.cursor) {
                args.cursor = { id: this._cursorPagination.cursor };
                args.skip = 1; // Skip the cursor record
            }
            args.take = this._cursorPagination.take + 1; // Fetch one extra to check hasMore
        } else {
            if (this._skip !== null) args.skip = this._skip;
            if (this._take !== null) args.take = this._take;
        }

        return args;
    }

    /**
     * Execute the query and return results
     */
    async execute(): Promise<TSelect[]> {
        const args = this.buildArgs();
        const results = await this.model.findMany(args);
        return results as unknown as TSelect[];
    }

    /**
     * Execute with pagination
     */
    async executePaginated(): Promise<PaginatedResult<TSelect>> {
        if (!this._pagination) {
            throw new Error('Pagination not configured. Call .paginate() first.');
        }

        const args = this.buildArgs();

        const [rawData, total] = await Promise.all([
            this.model.findMany(args),
            this.model.count({ where: this._where }),
        ]);

        const data = rawData as unknown as TSelect[];

        const totalPages = Math.ceil(total / this._pagination.perPage);

        return {
            data,
            meta: {
                total,
                page: this._pagination.page,
                perPage: this._pagination.perPage,
                totalPages,
                hasNextPage: this._pagination.page < totalPages,
                hasPrevPage: this._pagination.page > 1,
            },
        };
    }

    /**
     * Execute with cursor pagination
     */
    async executeCursorPaginated(
        getId: (item: TSelect) => string
    ): Promise<CursorPaginatedResult<TSelect>> {
        if (!this._cursorPagination) {
            throw new Error('Cursor pagination not configured. Call .cursorPaginate() first.');
        }

        const args = this.buildArgs();
        const rawResults = await this.model.findMany(args);
        const results = rawResults as unknown as TSelect[];

        const take = this._cursorPagination.take;
        const hasMore = results.length > take;
        const data = results.slice(0, take);
        const lastItem = data[data.length - 1];
        const cursor = lastItem ? getId(lastItem) : null;

        return {
            data,
            meta: {
                cursor,
                hasMore,
            },
        };
    }

    /**
     * Get count of matching records
     */
    async count(): Promise<number> {
        return this.model.count({ where: this._where });
    }

    /**
     * Check if any record exists
     */
    async exists(): Promise<boolean> {
        const count = await this.model.count({ where: this._where });
        return count > 0;
    }

    /**
     * Get first matching record
     */
    async first(): Promise<TSelect | null> {
        const results = await this.take(1).execute();
        return results[0] || null;
    }
}

// ============================================
// FACTORY FUNCTION
// ============================================

/**
 * Create a query builder for a Prisma model
 */
export function query<T>(model: {
    findMany: (args: unknown) => Promise<T[]>;
    count: (args: unknown) => Promise<number>;
}): QueryBuilder<T> {
    return new QueryBuilder<T>(model);
}
