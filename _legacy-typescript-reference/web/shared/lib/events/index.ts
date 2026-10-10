/**
 * Domain Events
 * 
 * Event-driven architecture for decoupling side effects
 * from core business logic. Events are published when
 * domain actions occur and handlers react asynchronously.
 * 
 * @module lib/shared/events
 */

// ============================================
// EVENT INTERFACES
// ============================================

/**
 * Base interface for domain events
 */
export interface IDomainEvent {
    /** Unique event type identifier */
    readonly type: string;
    /** Timestamp when event occurred */
    readonly occurredAt: Date;
    /** Optional correlation ID for tracking */
    readonly correlationId?: string;
    /** Aggregate/Entity ID that raised the event */
    readonly aggregateId?: string;
}

/**
 * Base class for domain events
 */
export abstract class DomainEvent implements IDomainEvent {
    readonly occurredAt: Date;
    readonly correlationId: string;

    abstract get type(): string;

    constructor(
        readonly aggregateId?: string,
        correlationId?: string
    ) {
        this.occurredAt = new Date();
        this.correlationId = correlationId ?? crypto.randomUUID();
    }

    /**
     * Serialize event to JSON (for logging/storage)
     */
    toJSON(): Record<string, unknown> {
        return {
            type: this.type,
            occurredAt: this.occurredAt.toISOString(),
            correlationId: this.correlationId,
            aggregateId: this.aggregateId,
            ...this.getPayload(),
        };
    }

    /**
     * Get event-specific payload for serialization
     */
    protected abstract getPayload(): Record<string, unknown>;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends IDomainEvent = IDomainEvent> = (event: T) => Promise<void>;

/**
 * Event handler options
 */
export interface EventHandlerOptions {
    /** Handler name for logging */
    name?: string;
    /** Whether handler should be executed async (fire and forget) */
    async?: boolean;
    /** Retry count on failure */
    retries?: number;
    /** Priority (lower = earlier execution) */
    priority?: number;
}

// ============================================
// EVENT BUS
// ============================================

interface RegisteredHandler {
    handler: EventHandler;
    options: EventHandlerOptions;
}

/**
 * Event Bus - Publishes and dispatches domain events
 */
export class EventBus {
    private handlers = new Map<string, RegisteredHandler[]>();
    private globalHandlers: RegisteredHandler[] = [];
    private isProcessing = false;
    private eventQueue: IDomainEvent[] = [];

    /**
     * Subscribe to a specific event type
     */
    subscribe<T extends IDomainEvent>(
        eventType: string,
        handler: EventHandler<T>,
        options: EventHandlerOptions = {}
    ): () => void {
        const registered: RegisteredHandler = {
            handler: handler as EventHandler,
            options: { priority: 100, ...options },
        };

        const handlers = this.handlers.get(eventType) ?? [];
        handlers.push(registered);
        handlers.sort((a, b) => (a.options.priority ?? 100) - (b.options.priority ?? 100));
        this.handlers.set(eventType, handlers);

        // Return unsubscribe function
        return () => {
            const current = this.handlers.get(eventType) ?? [];
            const index = current.indexOf(registered);
            if (index >= 0) {
                current.splice(index, 1);
            }
        };
    }

    /**
     * Subscribe to all events
     */
    subscribeAll(
        handler: EventHandler,
        options: EventHandlerOptions = {}
    ): () => void {
        const registered: RegisteredHandler = {
            handler,
            options: { priority: 100, ...options },
        };

        this.globalHandlers.push(registered);
        this.globalHandlers.sort((a, b) => (a.options.priority ?? 100) - (b.options.priority ?? 100));

        return () => {
            const index = this.globalHandlers.indexOf(registered);
            if (index >= 0) {
                this.globalHandlers.splice(index, 1);
            }
        };
    }

    /**
     * Publish an event
     */
    async publish(event: IDomainEvent): Promise<void> {
        this.eventQueue.push(event);

        // Process queue if not already processing
        if (!this.isProcessing) {
            await this.processQueue();
        }
    }

    /**
     * Publish multiple events
     */
    async publishAll(events: IDomainEvent[]): Promise<void> {
        this.eventQueue.push(...events);

        if (!this.isProcessing) {
            await this.processQueue();
        }
    }

    /**
     * Process event queue
     */
    private async processQueue(): Promise<void> {
        this.isProcessing = true;

        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift()!;
            await this.dispatch(event);
        }

        this.isProcessing = false;
    }

    /**
     * Dispatch event to handlers
     */
    private async dispatch(event: IDomainEvent): Promise<void> {
        const handlers = [
            ...this.globalHandlers,
            ...(this.handlers.get(event.type) ?? []),
        ];

        const syncHandlers = handlers.filter(h => !h.options.async);
        const asyncHandlers = handlers.filter(h => h.options.async);

        // Execute sync handlers sequentially
        for (const { handler, options } of syncHandlers) {
            await this.executeHandler(handler, event, options);
        }

        // Fire async handlers (don't await)
        for (const { handler, options } of asyncHandlers) {
            this.executeHandler(handler, event, options).catch(err => {
                console.error(`[EventBus] Async handler ${options.name ?? 'unknown'} failed:`, err);
            });
        }
    }

    /**
     * Execute a handler with retry logic
     */
    private async executeHandler(
        handler: EventHandler,
        event: IDomainEvent,
        options: EventHandlerOptions
    ): Promise<void> {
        const retries = options.retries ?? 0;
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                await handler(event);
                return;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (attempt < retries) {
                    // Wait before retry (exponential backoff)
                    await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 100));
                }
            }
        }

        console.error(`[EventBus] Handler ${options.name ?? 'unknown'} failed after ${retries + 1} attempts:`, lastError);
        throw lastError;
    }

    /**
     * Clear all handlers (useful for testing)
     */
    clear(): void {
        this.handlers.clear();
        this.globalHandlers = [];
        this.eventQueue = [];
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let eventBusInstance: EventBus | null = null;

/**
 * Get the global event bus instance
 */
export function getEventBus(): EventBus {
    if (!eventBusInstance) {
        eventBusInstance = new EventBus();
    }
    return eventBusInstance;
}

/**
 * Reset event bus (useful for testing)
 */
export function resetEventBus(): void {
    eventBusInstance?.clear();
    eventBusInstance = null;
}

// ============================================
// COMMON DOMAIN EVENTS
// ============================================

/**
 * Invoice emitted event
 */
export class InvoiceEmittedEvent extends DomainEvent {
    get type(): string {
        return 'invoice.emitted';
    }

    constructor(
        readonly invoiceId: string,
        readonly cufe: string,
        readonly invoiceNumber: string,
        readonly clientEmail?: string,
        readonly totalAmount?: number,
        correlationId?: string
    ) {
        super(invoiceId, correlationId);
    }

    protected getPayload(): Record<string, unknown> {
        return {
            invoiceId: this.invoiceId,
            cufe: this.cufe,
            invoiceNumber: this.invoiceNumber,
            clientEmail: this.clientEmail,
            totalAmount: this.totalAmount,
        };
    }
}

/**
 * Invoice cancelled event
 */
export class InvoiceCancelledEvent extends DomainEvent {
    get type(): string {
        return 'invoice.cancelled';
    }

    constructor(
        readonly invoiceId: string,
        readonly reason: string,
        readonly cancelledBy: string,
        correlationId?: string
    ) {
        super(invoiceId, correlationId);
    }

    protected getPayload(): Record<string, unknown> {
        return {
            invoiceId: this.invoiceId,
            reason: this.reason,
            cancelledBy: this.cancelledBy,
        };
    }
}

/**
 * Folios low event
 */
export class FoliosLowEvent extends DomainEvent {
    get type(): string {
        return 'folios.low';
    }

    constructor(
        readonly clientId: string,
        readonly available: number,
        readonly threshold: number,
        correlationId?: string
    ) {
        super(clientId, correlationId);
    }

    protected getPayload(): Record<string, unknown> {
        return {
            clientId: this.clientId,
            available: this.available,
            threshold: this.threshold,
        };
    }
}

/**
 * User action event (for audit)
 */
export class UserActionEvent extends DomainEvent {
    get type(): string {
        return 'user.action';
    }

    constructor(
        readonly userId: string,
        readonly action: string,
        readonly entity: string,
        readonly entityId: string,
        readonly changes?: Record<string, unknown>,
        correlationId?: string
    ) {
        super(userId, correlationId);
    }

    protected getPayload(): Record<string, unknown> {
        return {
            userId: this.userId,
            action: this.action,
            entity: this.entity,
            entityId: this.entityId,
            changes: this.changes,
        };
    }
}

// ============================================
// HELPER DECORATORS
// ============================================

/**
 * Decorator to automatically publish events after method execution
 */
export function PublishesEvents() {
    return function (
        target: unknown,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: unknown[]) {
            const result = await originalMethod.apply(this, args);

            // If result contains events array, publish them
            if (result && typeof result === 'object' && 'events' in result) {
                const events = result.events as IDomainEvent[];
                if (Array.isArray(events) && events.length > 0) {
                    await getEventBus().publishAll(events);
                }
            }

            return result;
        };

        return descriptor;
    };
}
