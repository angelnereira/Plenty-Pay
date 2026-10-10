/**
 * API Response Types
 * Tipos estándar para respuestas de API
 */

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface ErrorResponse {
    success: false;
    error: string;
    code?: string;
    details?: Record<string, unknown>;
}
