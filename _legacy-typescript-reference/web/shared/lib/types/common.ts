/**
 * Common Types
 * Tipos genéricos comunes
 */

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T, E = Error> = Promise<{ data?: T; error?: E }>;

export interface Timestamps {
    createdAt: Date;
    updatedAt: Date;
}

export interface SoftDelete {
    deletedAt: Date | null;
}
