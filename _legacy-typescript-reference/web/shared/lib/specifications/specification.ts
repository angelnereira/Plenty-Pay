/**
 * Specification Pattern
 * 
 * Encapsulates business rules and query criteria into reusable,
 * composable objects. Reduces query duplication and centralizes
 * business logic.
 * 
 * @module lib/shared/specifications
 */

// ============================================
// BASE SPECIFICATION INTERFACE
// ============================================

/**
 * Base Specification interface
 * @template T - The entity type this specification applies to
 */
export interface ISpecification<T> {
    /**
     * Check if an entity satisfies this specification
     */
    isSatisfiedBy(entity: T): boolean;

    /**
     * Convert to Prisma where clause
     */
    toPrismaWhere(): Record<string, unknown>;

    /**
     * Combine with another specification using AND
     */
    and(other: ISpecification<T>): ISpecification<T>;

    /**
     * Combine with another specification using OR
     */
    or(other: ISpecification<T>): ISpecification<T>;

    /**
     * Negate this specification
     */
    not(): ISpecification<T>;
}

// ============================================
// BASE SPECIFICATION CLASS
// ============================================

/**
 * Abstract base class for specifications
 */
export abstract class Specification<T> implements ISpecification<T> {
    abstract isSatisfiedBy(entity: T): boolean;
    abstract toPrismaWhere(): Record<string, unknown>;

    and(other: ISpecification<T>): ISpecification<T> {
        return new AndSpecification(this, other);
    }

    or(other: ISpecification<T>): ISpecification<T> {
        return new OrSpecification(this, other);
    }

    not(): ISpecification<T> {
        return new NotSpecification(this);
    }
}

// ============================================
// COMPOSITE SPECIFICATIONS
// ============================================

class AndSpecification<T> extends Specification<T> {
    constructor(
        private left: ISpecification<T>,
        private right: ISpecification<T>
    ) {
        super();
    }

    isSatisfiedBy(entity: T): boolean {
        return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
    }

    toPrismaWhere(): Record<string, unknown> {
        return {
            AND: [
                this.left.toPrismaWhere(),
                this.right.toPrismaWhere(),
            ],
        };
    }
}

class OrSpecification<T> extends Specification<T> {
    constructor(
        private left: ISpecification<T>,
        private right: ISpecification<T>
    ) {
        super();
    }

    isSatisfiedBy(entity: T): boolean {
        return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
    }

    toPrismaWhere(): Record<string, unknown> {
        return {
            OR: [
                this.left.toPrismaWhere(),
                this.right.toPrismaWhere(),
            ],
        };
    }
}

class NotSpecification<T> extends Specification<T> {
    constructor(private spec: ISpecification<T>) {
        super();
    }

    isSatisfiedBy(entity: T): boolean {
        return !this.spec.isSatisfiedBy(entity);
    }

    toPrismaWhere(): Record<string, unknown> {
        return {
            NOT: this.spec.toPrismaWhere(),
        };
    }
}

// ============================================
// SPECIFICATION BUILDER
// ============================================

/**
 * Fluent builder for creating specifications
 */
export class SpecificationBuilder<T> {
    private specs: ISpecification<T>[] = [];

    add(spec: ISpecification<T>): this {
        this.specs.push(spec);
        return this;
    }

    addIf(condition: boolean, spec: ISpecification<T>): this {
        if (condition) {
            this.specs.push(spec);
        }
        return this;
    }

    build(): ISpecification<T> | null {
        if (this.specs.length === 0) return null;
        if (this.specs.length === 1) return this.specs[0];

        return this.specs.reduce((acc, spec) => acc.and(spec));
    }

    toPrismaWhere(): Record<string, unknown> {
        const spec = this.build();
        return spec ? spec.toPrismaWhere() : {};
    }
}

// ============================================
// COMMON GENERIC SPECIFICATIONS
// ============================================

/**
 * Specification for entities with an ID field
 */
export class IdSpec<T extends { id: string }> extends Specification<T> {
    constructor(private id: string) {
        super();
    }

    isSatisfiedBy(entity: T): boolean {
        return entity.id === this.id;
    }

    toPrismaWhere(): Record<string, unknown> {
        return { id: this.id };
    }
}

/**
 * Specification for entities with date range
 */
export class DateRangeSpec<T extends Record<string, unknown>> extends Specification<T> {
    constructor(
        private field: keyof T,
        private from?: Date,
        private to?: Date
    ) {
        super();
    }

    isSatisfiedBy(entity: T): boolean {
        const value = entity[this.field];
        if (!(value instanceof Date)) return false;

        if (this.from && value < this.from) return false;
        if (this.to && value > this.to) return false;
        return true;
    }

    toPrismaWhere(): Record<string, unknown> {
        const where: Record<string, unknown> = {};
        const constraints: Record<string, unknown> = {};

        if (this.from) constraints.gte = this.from;
        if (this.to) constraints.lte = this.to;

        if (Object.keys(constraints).length > 0) {
            where[this.field as string] = constraints;
        }

        return where;
    }
}

/**
 * Specification for active/inactive entities
 */
export class IsActiveSpec<T extends { isActive?: boolean }> extends Specification<T> {
    constructor(private active: boolean = true) {
        super();
    }

    isSatisfiedBy(entity: T): boolean {
        return entity.isActive === this.active;
    }

    toPrismaWhere(): Record<string, unknown> {
        return { isActive: this.active };
    }
}

/**
 * Specification for entities belonging to a client
 */
export class ClientIdSpec<T extends { clientId?: string }> extends Specification<T> {
    constructor(private clientId: string) {
        super();
    }

    isSatisfiedBy(entity: T): boolean {
        return entity.clientId === this.clientId;
    }

    toPrismaWhere(): Record<string, unknown> {
        return { clientId: this.clientId };
    }
}

/**
 * Specification for text search (contains, case insensitive)
 */
export class ContainsSpec<T extends Record<string, unknown>> extends Specification<T> {
    constructor(
        private field: keyof T,
        private searchTerm: string
    ) {
        super();
    }

    isSatisfiedBy(entity: T): boolean {
        const value = entity[this.field];
        if (typeof value !== 'string') return false;
        return value.toLowerCase().includes(this.searchTerm.toLowerCase());
    }

    toPrismaWhere(): Record<string, unknown> {
        return {
            [this.field]: {
                contains: this.searchTerm,
                mode: 'insensitive',
            },
        };
    }
}

// ============================================
// EXPORTS
// ============================================

export {
    AndSpecification,
    OrSpecification,
    NotSpecification,
};
