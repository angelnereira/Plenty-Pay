/**
 * Command Pattern (CQRS Lite)
 * 
 * Separates read (Query) and write (Command) operations.
 * Commands represent intentions to change state.
 * 
 * @module lib/shared/cqrs
 */

import {
    type Result,
    type AsyncServiceResult,
    Ok,
    Err,
    ValidationError,
} from '@shared/lib/result';

// ============================================
// COMMAND INTERFACES
// ============================================

/**
 * Base interface for all commands
 */
export interface ICommand {
    /** Unique command type identifier */
    readonly type: string;
    /** Timestamp when command was created */
    readonly timestamp: Date;
    /** Optional correlation ID for tracking */
    readonly correlationId?: string;
}

/**
 * Base command class with common properties
 */
export abstract class Command implements ICommand {
    readonly timestamp: Date;
    readonly correlationId?: string;

    abstract get type(): string;

    constructor(correlationId?: string) {
        this.timestamp = new Date();
        this.correlationId = correlationId ?? crypto.randomUUID();
    }
}

/**
 * Command handler interface
 * @template TCommand - The command type
 * @template TResult - The result type
 */
export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
    /**
     * Execute the command
     */
    execute(command: TCommand): AsyncServiceResult<TResult>;

    /**
     * Optional validation before execution
     */
    validate?(command: TCommand): Result<void, ValidationError>;
}

/**
 * Command handler with validation
 */
export abstract class CommandHandler<TCommand extends ICommand, TResult = void>
    implements ICommandHandler<TCommand, TResult>
{
    async execute(command: TCommand): AsyncServiceResult<TResult> {
        // Validate first if validation is defined
        const validation = this.validate?.(command);
        if (validation && !validation.ok) {
            return validation;
        }

        // Execute the command
        return this.handle(command);
    }

    /**
     * Implement command handling logic
     */
    protected abstract handle(command: TCommand): AsyncServiceResult<TResult>;

    /**
     * Optional validation implementation
     */
    validate?(command: TCommand): Result<void, ValidationError>;
}

// ============================================
// COMMAND BUS
// ============================================

type HandlerFactory<TCommand extends ICommand, TResult> =
    () => ICommandHandler<TCommand, TResult>;

/**
 * Command Bus - Dispatches commands to their handlers
 */
export class CommandBus {
    private handlers = new Map<string, HandlerFactory<ICommand, unknown>>();
    private middleware: CommandMiddleware[] = [];

    /**
     * Register a handler for a command type
     */
    register<TCommand extends ICommand, TResult>(
        commandType: string,
        handlerFactory: HandlerFactory<TCommand, TResult>
    ): void {
        this.handlers.set(commandType, handlerFactory as HandlerFactory<ICommand, unknown>);
    }

    /**
     * Add middleware to the command pipeline
     */
    use(middleware: CommandMiddleware): void {
        this.middleware.push(middleware);
    }

    /**
     * Execute a command through the bus
     */
    async execute<TResult>(command: ICommand): AsyncServiceResult<TResult> {
        const handlerFactory = this.handlers.get(command.type);

        if (!handlerFactory) {
            return Err(new ValidationError(
                'command',
                `No handler registered for command type: ${command.type}`
            ));
        }

        // Create handler instance
        const handler = handlerFactory();

        // Build middleware chain
        let execute = () => handler.execute(command) as AsyncServiceResult<TResult>;

        // Apply middleware in reverse order
        for (let i = this.middleware.length - 1; i >= 0; i--) {
            const next = execute;
            const mw = this.middleware[i];
            execute = () => mw(command, next);
        }

        return execute();
    }
}

/**
 * Middleware function type
 */
export type CommandMiddleware = <TResult>(
    command: ICommand,
    next: () => AsyncServiceResult<TResult>
) => AsyncServiceResult<TResult>;

// ============================================
// BUILT-IN MIDDLEWARE
// ============================================

/**
 * Logging middleware - logs command execution
 */
export function loggingMiddleware(
    logger: { info: (msg: string, data?: unknown) => void; error: (msg: string, data?: unknown) => void }
): CommandMiddleware {
    return async <TResult>(command: ICommand, next: () => AsyncServiceResult<TResult>) => {
        const start = Date.now();
        logger.info(`[Command] Executing ${command.type}`, { correlationId: command.correlationId });

        const result = await next();
        const duration = Date.now() - start;

        if (result.ok) {
            logger.info(`[Command] ${command.type} completed in ${duration}ms`, { correlationId: command.correlationId });
        } else {
            logger.error(`[Command] ${command.type} failed after ${duration}ms`, {
                correlationId: command.correlationId,
                error: result.error,
            });
        }

        return result;
    };
}

/**
 * Validation middleware - validates commands before execution
 */
export function validationMiddleware(): CommandMiddleware {
    return async <TResult>(command: ICommand, next: () => AsyncServiceResult<TResult>) => {
        // Check if command has validate method
        if ('validate' in command && typeof command.validate === 'function') {
            const validation = command.validate();
            if (!validation.ok) {
                return validation as AsyncServiceResult<TResult>;
            }
        }

        return next();
    };
}

// ============================================
// QUERY INTERFACES
// ============================================

/**
 * Base interface for queries
 */
export interface IQuery<TResult> {
    readonly type: string;
}

/**
 * Query handler interface
 */
export interface IQueryHandler<TQuery extends IQuery<TResult>, TResult> {
    execute(query: TQuery): AsyncServiceResult<TResult>;
}

/**
 * Query Bus - Dispatches queries to their handlers
 */
export class QueryBus {
    private handlers = new Map<string, () => IQueryHandler<IQuery<unknown>, unknown>>();

    register<TQuery extends IQuery<TResult>, TResult>(
        queryType: string,
        handlerFactory: () => IQueryHandler<TQuery, TResult>
    ): void {
        this.handlers.set(queryType, handlerFactory as () => IQueryHandler<IQuery<unknown>, unknown>);
    }

    async execute<TResult>(query: IQuery<TResult>): AsyncServiceResult<TResult> {
        const handlerFactory = this.handlers.get(query.type);

        if (!handlerFactory) {
            return Err(new ValidationError(
                'query',
                `No handler registered for query type: ${query.type}`
            ));
        }

        const handler = handlerFactory();
        return handler.execute(query as IQuery<unknown>) as AsyncServiceResult<TResult>;
    }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

let commandBusInstance: CommandBus | null = null;
let queryBusInstance: QueryBus | null = null;

/**
 * Get the global command bus instance
 */
export function getCommandBus(): CommandBus {
    if (!commandBusInstance) {
        commandBusInstance = new CommandBus();
    }
    return commandBusInstance;
}

/**
 * Get the global query bus instance
 */
export function getQueryBus(): QueryBus {
    if (!queryBusInstance) {
        queryBusInstance = new QueryBus();
    }
    return queryBusInstance;
}

/**
 * Reset buses (useful for testing)
 */
export function resetBuses(): void {
    commandBusInstance = null;
    queryBusInstance = null;
}
