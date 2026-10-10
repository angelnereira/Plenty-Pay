/**
 * Shared Module - Barrel Export
 * 
 * Core patterns and utilities shared across the application.
 */

// Result Pattern (Error Handling)
export * from './result';

// Specification Pattern (Query Building)
export * from './specifications';

// CQRS (Command/Query Separation)
export * from './cqrs';

// Domain Events
export * from './events';

// Unit of Work (Transactions)
export * from './uow';

// Dependency Injection Container
export * from './container';

// State Machine
export * from './state-machine';

// Query Builder
export * from './query-builder';

// Observable (Reactive State)
export * from './observable';
