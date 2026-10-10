/**
 * Auth Repository
 */

import { prisma } from '@core/database';
import type { User, RegisterDTO } from '../types/auth.types';
import { hash } from 'bcryptjs';

export class AuthRepository {
    async findByEmail(email: string): Promise<User | null> {
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                clientId: true,
            },
        });

        return user as User | null;
    }

    async createUser(data: RegisterDTO & { hashedPassword: string }): Promise<User> {
        const user = await prisma.user.create({
            data: {
                email: data.email,
                name: data.name,
                password: data.hashedPassword,
                role: 'CLIENT',
                client: {
                    create: {
                        name: data.companyName,
                        slug: data.companyName.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, ''),
                    },
                },
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                clientId: true,
            },
        });

        return user as User;
    }

    async verifyPassword(email: string, password: string): Promise<boolean> {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { password: true },
        });

        if (!user) return false;

        const bcrypt = require('bcryptjs');
        return bcrypt.compare(password, user.password);
    }
}
