/**
 * Tests de Integración (DB real) - AuthService
 *
 * Registro y login contra PostgreSQL real: verifica hashing de contraseñas,
 * unicidad de email y el flujo completo usuario+organización.
 */

import { AuthService } from '@/lib/features/auth';
import { prisma, RUN_ID, assertSafeDatabase } from './helpers';

const EMAIL = `auth-${RUN_ID}@test.plentypay.local`;
const PASSWORD = 'Password!123';

describe('AuthService (integración DB)', () => {
    const service = new AuthService();

    beforeAll(() => {
        assertSafeDatabase();
    });

    afterAll(async () => {
        // El borrado del usuario no cascadea a la organización creada en
        // register(); se borra la organización (Client) y cascadea al usuario.
        const user = await prisma.user.findUnique({ where: { email: EMAIL } });
        if (user) {
            await prisma.client.delete({ where: { id: user.clientId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it('register crea usuario y organización con contraseña hasheada', async () => {
        const result = await service.register({
            email: EMAIL,
            password: PASSWORD,
            name: 'Usuario Integración',
            companyName: `Empresa ${RUN_ID}`,
        });

        expect(result.success).toBe(true);
        expect(result.user?.email).toBe(EMAIL);
        expect(result.user?.clientId).toBeDefined();

        // La contraseña NUNCA debe persistirse en claro
        const stored = await prisma.user.findUnique({
            where: { email: EMAIL },
            select: { password: true },
        });
        expect(stored?.password).toBeDefined();
        expect(stored?.password).not.toBe(PASSWORD);
        expect(stored?.password).toMatch(/^\$2[aby]\$/); // formato bcrypt
    });

    it('register rechaza email duplicado', async () => {
        const result = await service.register({
            email: EMAIL,
            password: 'OtraClave!456',
            name: 'Duplicado',
            companyName: 'Empresa Duplicada',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('ya registrado');
    });

    it('login exitoso con credenciales válidas', async () => {
        const result = await service.login({ email: EMAIL, password: PASSWORD });

        expect(result.success).toBe(true);
        expect(result.user?.email).toBe(EMAIL);
    });

    it('login falla con contraseña incorrecta', async () => {
        const result = await service.login({ email: EMAIL, password: 'incorrecta' });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Contraseña incorrecta');
    });

    it('login falla con usuario inexistente', async () => {
        const result = await service.login({
            email: `noexiste-${RUN_ID}@test.plentypay.local`,
            password: PASSWORD,
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Usuario no encontrado');
    });
});
