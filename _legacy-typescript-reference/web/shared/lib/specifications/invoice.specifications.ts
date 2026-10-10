/**
 * Invoice Specifications
 * 
 * Domain-specific specifications for Invoice entity.
 * Provides fluent API for building complex invoice queries.
 * 
 * @module lib/shared/specifications/invoice.specifications
 */

import {
    Specification,
    SpecificationBuilder,
    DateRangeSpec,
    ClientIdSpec,
    ContainsSpec,
} from './specification';

// ============================================
// TYPES
// ============================================

/**
 * Invoice entity type (matches Prisma model)
 */
export interface InvoiceEntity {
    id: string;
    invoiceNumber?: string | null;
    clientId: string;
    status: string;
    totalAmount: number;
    cufe?: string | null;
    createdAt: Date;
    updatedAt: Date;
    receiverName?: string | null;
    receiverRuc?: string | null;
    [key: string]: any;
}

/**
 * Invoice status enum
 */
export type InvoiceStatus =
    | 'DRAFT'
    | 'PENDING'
    | 'CERTIFIED'
    | 'SENT'
    | 'CANCELLED'
    | 'ERROR';

// ============================================
// INVOICE SPECIFICATIONS
// ============================================

/**
 * Specification for invoice status
 */
export class InvoiceStatusSpec extends Specification<InvoiceEntity> {
    constructor(private status: InvoiceStatus | InvoiceStatus[]) {
        super();
    }

    isSatisfiedBy(entity: InvoiceEntity): boolean {
        if (Array.isArray(this.status)) {
            return this.status.includes(entity.status as InvoiceStatus);
        }
        return entity.status === this.status;
    }

    toPrismaWhere(): Record<string, unknown> {
        if (Array.isArray(this.status)) {
            return { status: { in: this.status } };
        }
        return { status: this.status };
    }
}

/**
 * Specification for invoices with CUFE (certified)
 */
export class HasCufeSpec extends Specification<InvoiceEntity> {
    constructor(private hasCufe: boolean = true) {
        super();
    }

    isSatisfiedBy(entity: InvoiceEntity): boolean {
        const entityHasCufe = !!entity.cufe;
        return this.hasCufe ? entityHasCufe : !entityHasCufe;
    }

    toPrismaWhere(): Record<string, unknown> {
        return this.hasCufe
            ? { cufe: { not: null } }
            : { cufe: null };
    }
}

/**
 * Specification for invoice amount range
 */
export class InvoiceAmountSpec extends Specification<InvoiceEntity> {
    constructor(
        private minAmount?: number,
        private maxAmount?: number
    ) {
        super();
    }

    isSatisfiedBy(entity: InvoiceEntity): boolean {
        if (this.minAmount !== undefined && entity.totalAmount < this.minAmount) {
            return false;
        }
        if (this.maxAmount !== undefined && entity.totalAmount > this.maxAmount) {
            return false;
        }
        return true;
    }

    toPrismaWhere(): Record<string, unknown> {
        const constraints: Record<string, unknown> = {};

        if (this.minAmount !== undefined) constraints.gte = this.minAmount;
        if (this.maxAmount !== undefined) constraints.lte = this.maxAmount;

        return Object.keys(constraints).length > 0
            ? { totalAmount: constraints }
            : {};
    }
}

/**
 * Specification for invoices from last N days
 */
export class InvoiceFromLastDaysSpec extends Specification<InvoiceEntity> {
    private fromDate: Date;

    constructor(days: number) {
        super();
        this.fromDate = new Date();
        this.fromDate.setDate(this.fromDate.getDate() - days);
        this.fromDate.setHours(0, 0, 0, 0);
    }

    isSatisfiedBy(entity: InvoiceEntity): boolean {
        return entity.createdAt >= this.fromDate;
    }

    toPrismaWhere(): Record<string, unknown> {
        return {
            createdAt: { gte: this.fromDate },
        };
    }
}

/**
 * Specification for invoices in current month
 */
export class InvoiceCurrentMonthSpec extends Specification<InvoiceEntity> {
    private startOfMonth: Date;
    private endOfMonth: Date;

    constructor() {
        super();
        const now = new Date();
        this.startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        this.endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    isSatisfiedBy(entity: InvoiceEntity): boolean {
        return entity.createdAt >= this.startOfMonth && entity.createdAt <= this.endOfMonth;
    }

    toPrismaWhere(): Record<string, unknown> {
        return {
            createdAt: {
                gte: this.startOfMonth,
                lte: this.endOfMonth,
            },
        };
    }
}

/**
 * Specification for searching by invoice number
 */
export class InvoiceNumberSpec extends Specification<InvoiceEntity> {
    constructor(private invoiceNumber: string) {
        super();
    }

    isSatisfiedBy(entity: InvoiceEntity): boolean {
        return entity.invoiceNumber === this.invoiceNumber;
    }

    toPrismaWhere(): Record<string, unknown> {
        return { invoiceNumber: this.invoiceNumber };
    }
}

/**
 * Specification for searching by receiver
 */
export class InvoiceReceiverSpec extends Specification<InvoiceEntity> {
    constructor(private searchTerm: string) {
        super();
    }

    isSatisfiedBy(entity: InvoiceEntity): boolean {
        const name = entity.receiverName?.toLowerCase() || '';
        const ruc = entity.receiverRuc?.toLowerCase() || '';
        const term = this.searchTerm.toLowerCase();
        return name.includes(term) || ruc.includes(term);
    }

    toPrismaWhere(): Record<string, unknown> {
        return {
            OR: [
                { receiverName: { contains: this.searchTerm, mode: 'insensitive' } },
                { receiverRuc: { contains: this.searchTerm, mode: 'insensitive' } },
            ],
        };
    }
}

// ============================================
// FLUENT INVOICE SPECIFICATION BUILDER
// ============================================

/**
 * Fluent builder for invoice specifications
 * 
 * @example
 * ```typescript
 * const spec = InvoiceSpec.create()
 *   .forClient(clientId)
 *   .withStatus(['CERTIFIED', 'SENT'])
 *   .fromLastDays(30)
 *   .withMinAmount(100)
 *   .build();
 * 
 * const invoices = await prisma.invoice.findMany({
 *   where: spec.toPrismaWhere()
 * });
 * ```
 */
export class InvoiceSpecBuilder {
    private builder = new SpecificationBuilder<InvoiceEntity>();

    static create(): InvoiceSpecBuilder {
        return new InvoiceSpecBuilder();
    }

    /**
     * Filter by client ID
     */
    forClient(clientId: string): this {
        this.builder.add(new ClientIdSpec(clientId));
        return this;
    }

    /**
     * Filter by status(es)
     */
    withStatus(status: InvoiceStatus | InvoiceStatus[]): this {
        this.builder.add(new InvoiceStatusSpec(status));
        return this;
    }

    /**
     * Filter certified invoices (have CUFE)
     */
    certified(): this {
        this.builder.add(new HasCufeSpec(true));
        return this;
    }

    /**
     * Filter draft invoices (no CUFE)
     */
    drafts(): this {
        this.builder.add(new HasCufeSpec(false));
        return this;
    }

    /**
     * Filter by minimum amount
     */
    withMinAmount(amount: number): this {
        this.builder.add(new InvoiceAmountSpec(amount, undefined));
        return this;
    }

    /**
     * Filter by maximum amount
     */
    withMaxAmount(amount: number): this {
        this.builder.add(new InvoiceAmountSpec(undefined, amount));
        return this;
    }

    /**
     * Filter by amount range
     */
    withAmountBetween(min: number, max: number): this {
        this.builder.add(new InvoiceAmountSpec(min, max));
        return this;
    }

    /**
     * Filter from last N days
     */
    fromLastDays(days: number): this {
        this.builder.add(new InvoiceFromLastDaysSpec(days));
        return this;
    }

    /**
     * Filter current month only
     */
    currentMonth(): this {
        this.builder.add(new InvoiceCurrentMonthSpec());
        return this;
    }

    /**
     * Filter by date range
     */
    betweenDates(from?: Date, to?: Date): this {
        this.builder.add(new DateRangeSpec<InvoiceEntity>('createdAt', from, to));
        return this;
    }

    /**
     * Filter by invoice number
     */
    withInvoiceNumber(number: string): this {
        this.builder.add(new InvoiceNumberSpec(number));
        return this;
    }

    /**
     * Search by receiver name or RUC
     */
    searchReceiver(term: string): this {
        if (term.trim()) {
            this.builder.add(new InvoiceReceiverSpec(term));
        }
        return this;
    }

    /**
     * Add custom specification
     */
    custom(spec: Specification<InvoiceEntity>): this {
        this.builder.add(spec);
        return this;
    }

    /**
     * Build the final specification
     */
    build(): Specification<InvoiceEntity> | null {
        return this.builder.build() as Specification<InvoiceEntity> | null;
    }

    /**
     * Get Prisma where clause directly
     */
    toPrismaWhere(): Record<string, unknown> {
        return this.builder.toPrismaWhere();
    }
}

// ============================================
// CONVENIENCE FACTORY
// ============================================

/**
 * Convenience factory for invoice specifications
 */
export const InvoiceSpec = {
    create: () => InvoiceSpecBuilder.create(),

    // Pre-built common specs
    certified: () => new InvoiceStatusSpec('CERTIFIED'),
    pending: () => new InvoiceStatusSpec('PENDING'),
    drafts: () => new InvoiceStatusSpec('DRAFT'),
    cancelled: () => new InvoiceStatusSpec('CANCELLED'),
    errors: () => new InvoiceStatusSpec('ERROR'),

    forClient: (clientId: string) => new ClientIdSpec<InvoiceEntity>(clientId),
    fromLastDays: (days: number) => new InvoiceFromLastDaysSpec(days),
    currentMonth: () => new InvoiceCurrentMonthSpec(),
    withCufe: () => new HasCufeSpec(true),
    withoutCufe: () => new HasCufeSpec(false),
};
