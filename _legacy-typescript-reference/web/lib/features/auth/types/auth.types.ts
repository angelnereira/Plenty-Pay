/**
 * Auth Types
 */

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    clientId: string;
}

export type UserRole = 'SUPER_ADMIN' | 'CLIENT';

export interface LoginDTO {
    email: string;
    password: string;
}

export interface RegisterDTO {
    email: string;
    password: string;
    name: string;
    companyName: string;
}

export interface AuthResult {
    success: boolean;
    user?: User;
    token?: string;
    error?: string;
}
