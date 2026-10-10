/**
 * Auth Service
 */

import { AuthRepository } from '../repositories/auth.repository';
import type { LoginDTO, RegisterDTO, AuthResult } from '../types/auth.types';
import { hash } from 'bcryptjs';

export class AuthService {
    constructor(
        private authRepo: AuthRepository = new AuthRepository()
    ) { }

    async login(data: LoginDTO): Promise<AuthResult> {
        try {
            const user = await this.authRepo.findByEmail(data.email);

            if (!user) {
                return { success: false, error: 'Usuario no encontrado' };
            }

            const isValid = await this.authRepo.verifyPassword(data.email, data.password);

            if (!isValid) {
                return { success: false, error: 'Contraseña incorrecta' };
            }

            return { success: true, user };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error en login',
            };
        }
    }

    async register(data: RegisterDTO): Promise<AuthResult> {
        try {
            // Validar email único
            const existing = await this.authRepo.findByEmail(data.email);
            if (existing) {
                return { success: false, error: 'Email ya registrado' };
            }

            // Hash password
            const hashedPassword = await hash(data.password, 10);

            // Crear usuario y empresa
            const user = await this.authRepo.createUser({
                ...data,
                hashedPassword,
            });

            return { success: true, user };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Error en registro',
            };
        }
    }
}
