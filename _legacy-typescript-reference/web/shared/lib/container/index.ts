/**
 * Service Locator / Dependency Injection Container
 * 
 * Provides a lightweight IoC container for managing dependencies.
 * Supports singleton and transient lifecycles.
 * 
 * @module lib/shared/container
 */

// ============================================
// TYPES
// ============================================

/**
 * Service lifecycle
 */
export type ServiceLifecycle = 'singleton' | 'transient';

/**
 * Service registration options
 */
export interface ServiceOptions {
    /** Lifecycle: singleton or transient */
    lifecycle?: ServiceLifecycle;
    /** Whether to lazy load singleton (default: true) */
    lazy?: boolean;
}

/**
 * Service factory function
 */
export type ServiceFactory<T> = (container: Container) => T;

/**
 * Service registration
 */
interface ServiceRegistration<T> {
    factory: ServiceFactory<T>;
    options: Required<ServiceOptions>;
    instance?: T;
}

/**
 * Service token for type-safe resolution
 */
export class ServiceToken<T> {
    constructor(public readonly name: string) { }

    toString(): string {
        return this.name;
    }
}

// ============================================
// CONTAINER INTERFACE
// ============================================

/**
 * Container interface for dependency injection
 * Use this interface for mocking in tests
 */
export interface IContainer {
    register<T>(token: ServiceToken<T> | string, factory: ServiceFactory<T>, options?: ServiceOptions): this;
    singleton<T>(token: ServiceToken<T> | string, factory: ServiceFactory<T>): this;
    transient<T>(token: ServiceToken<T> | string, factory: ServiceFactory<T>): this;
    instance<T>(token: ServiceToken<T> | string, instance: T): this;
    resolve<T>(token: ServiceToken<T> | string): T;
    tryResolve<T>(token: ServiceToken<T> | string): T | undefined;
    isRegistered(token: ServiceToken<unknown> | string): boolean;
}

// ============================================
// CONTAINER
// ============================================

/**
 * Dependency Injection Container
 * 
 * @example
 * ```typescript
 * // Define tokens
 * const Tokens = {
 *   HKAFacade: new ServiceToken<HKAFacade>('HKAFacade'),
 *   InvoiceRepo: new ServiceToken<InvoiceRepository>('InvoiceRepo'),
 *   Logger: new ServiceToken<Logger>('Logger'),
 * };
 * 
 * // Register services
 * container.register(Tokens.Logger, () => new ConsoleLogger());
 * container.register(Tokens.HKAFacade, () => new HKAFacade(), { lifecycle: 'singleton' });
 * container.register(Tokens.InvoiceRepo, (c) => new InvoiceRepository(c.resolve(Tokens.Logger)));
 * 
 * // Resolve
 * const facade = container.resolve(Tokens.HKAFacade);
 * ```
 */
export class Container implements IContainer {
    private registrations = new Map<string, ServiceRegistration<unknown>>();
    private resolutionStack: string[] = [];

    /**
     * Register a service
     */
    register<T>(
        token: ServiceToken<T> | string,
        factory: ServiceFactory<T>,
        options: ServiceOptions = {}
    ): this {
        const key = typeof token === 'string' ? token : token.name;

        this.registrations.set(key, {
            factory: factory as ServiceFactory<unknown>,
            options: {
                lifecycle: options.lifecycle ?? 'transient',
                lazy: options.lazy ?? true,
            },
            instance: undefined,
        });

        // Eagerly create singleton if not lazy
        if (options.lifecycle === 'singleton' && options.lazy === false) {
            this.resolve(token);
        }

        return this;
    }

    /**
     * Register a singleton service
     */
    singleton<T>(
        token: ServiceToken<T> | string,
        factory: ServiceFactory<T>
    ): this {
        return this.register(token, factory, { lifecycle: 'singleton' });
    }

    /**
     * Register a transient service
     */
    transient<T>(
        token: ServiceToken<T> | string,
        factory: ServiceFactory<T>
    ): this {
        return this.register(token, factory, { lifecycle: 'transient' });
    }

    /**
     * Register an existing instance as singleton
     */
    instance<T>(token: ServiceToken<T> | string, instance: T): this {
        const key = typeof token === 'string' ? token : token.name;

        this.registrations.set(key, {
            factory: () => instance,
            options: { lifecycle: 'singleton', lazy: true },
            instance,
        });

        return this;
    }

    /**
     * Resolve a service
     */
    resolve<T>(token: ServiceToken<T> | string): T {
        const key = typeof token === 'string' ? token : token.name;
        const registration = this.registrations.get(key);

        if (!registration) {
            throw new Error(`Service not registered: ${key}`);
        }

        // Check for circular dependency
        if (this.resolutionStack.includes(key)) {
            throw new Error(
                `Circular dependency detected: ${this.resolutionStack.join(' -> ')} -> ${key}`
            );
        }

        // Return existing singleton instance
        if (registration.options.lifecycle === 'singleton' && registration.instance !== undefined) {
            return registration.instance as T;
        }

        // Create new instance
        this.resolutionStack.push(key);
        try {
            const instance = registration.factory(this) as T;

            if (registration.options.lifecycle === 'singleton') {
                registration.instance = instance;
            }

            return instance;
        } finally {
            this.resolutionStack.pop();
        }
    }

    /**
     * Try to resolve a service, returns undefined if not registered
     */
    tryResolve<T>(token: ServiceToken<T> | string): T | undefined {
        const key = typeof token === 'string' ? token : token.name;

        if (!this.registrations.has(key)) {
            return undefined;
        }

        return this.resolve(token);
    }

    /**
     * Check if a service is registered
     */
    isRegistered(token: ServiceToken<unknown> | string): boolean {
        const key = typeof token === 'string' ? token : token.name;
        return this.registrations.has(key);
    }

    /**
     * Remove a service registration
     */
    unregister(token: ServiceToken<unknown> | string): boolean {
        const key = typeof token === 'string' ? token : token.name;
        return this.registrations.delete(key);
    }

    /**
     * Clear all registrations
     */
    clear(): void {
        this.registrations.clear();
        this.resolutionStack = [];
    }

    /**
     * Create a child container that inherits registrations
     */
    createChild(): Container {
        const child = new Container();

        // Copy registrations (shallow)
        this.registrations.forEach((reg, key) => {
            child.registrations.set(key, { ...reg });
        });

        return child;
    }

    /**
     * Create a scoped container for request handling
     */
    createScope(): Container {
        const scope = this.createChild();

        // Reset singleton instances in scope (they'll be recreated)
        scope.registrations.forEach((reg) => {
            if (reg.options.lifecycle === 'singleton') {
                reg.instance = undefined;
            }
        });

        return scope;
    }
}

// ============================================
// GLOBAL CONTAINER
// ============================================

let globalContainer: Container | null = null;

/**
 * Get the global container instance
 */
export function getContainer(): Container {
    if (!globalContainer) {
        globalContainer = new Container();
    }
    return globalContainer;
}

/**
 * Reset the global container (useful for testing)
 */
export function resetContainer(): void {
    globalContainer?.clear();
    globalContainer = null;
}

// ============================================
// SERVICE TOKENS FOR APPLICATION
// ============================================

/**
 * Service interfaces for type-safe DI
 */
export interface ILogger {
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
    debug(message: string, data?: unknown): void;
}

export interface IEventBus {
    publish(event: unknown): Promise<void>;
    subscribe(eventType: string, handler: (event: unknown) => Promise<void>): () => void;
}

export interface ICommandBus {
    execute<T>(command: unknown): Promise<{ ok: boolean; value?: T; error?: unknown }>;
    register(commandType: string, handler: () => unknown): void;
}

export interface IRepository<T> {
    findById(id: string): Promise<T | null>;
    findAll(): Promise<T[]>;
    save(entity: T): Promise<T>;
    delete(id: string): Promise<boolean>;
}

/**
 * Pre-defined service tokens for the application
 */
export const ServiceTokens = {
    // HKA Services
    HKAFacade: new ServiceToken<unknown>('HKAFacade'),
    HKASoapClient: new ServiceToken<unknown>('HKASoapClient'),

    // Repositories
    InvoiceRepository: new ServiceToken<IRepository<unknown>>('InvoiceRepository'),
    ClientRepository: new ServiceToken<IRepository<unknown>>('ClientRepository'),
    UserRepository: new ServiceToken<IRepository<unknown>>('UserRepository'),

    // Infrastructure
    Logger: new ServiceToken<ILogger>('Logger'),
    EventBus: new ServiceToken<IEventBus>('EventBus'),
    CommandBus: new ServiceToken<ICommandBus>('CommandBus'),

    // Database
    PrismaClient: new ServiceToken<unknown>('PrismaClient'),
    UnitOfWork: new ServiceToken<unknown>('UnitOfWork'),
} as const;

// ============================================
// DECORATORS (experimental)
// ============================================

/**
 * Decorator metadata storage
 */
const injectableMetadata = new Map<Function, { token?: ServiceToken<unknown>; options?: ServiceOptions }>();

/**
 * Mark a class as injectable
 */
export function Injectable(options?: ServiceOptions & { token?: ServiceToken<unknown> }) {
    return function (target: Function) {
        injectableMetadata.set(target, options || {});
    };
}

/**
 * Auto-register all injectable classes
 */
export function autoRegister(container: Container, classes: Function[]): void {
    for (const cls of classes) {
        const metadata = injectableMetadata.get(cls);
        if (metadata) {
            const token = metadata.token || new ServiceToken(cls.name);
            container.register(token, () => new (cls as new () => unknown)(), metadata.options);
        }
    }
}
