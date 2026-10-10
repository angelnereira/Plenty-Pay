import { generateRegisterOptions, verifyRegistration, generateAuthOptions, verifyAuth } from './webauthn';
import { prisma } from '@core/database/prisma-singleton';
import * as SimpleWebAuthn from '@simplewebauthn/server';

// Mock Prisma
jest.mock('@core/database/prisma-singleton', () => ({
    prisma: {
        paydayEmployee: {
            findUnique: jest.fn(),
        },
        systemConfig: {
            upsert: jest.fn(),
            findUnique: jest.fn(),
            delete: jest.fn(),
            create: jest.fn(),
        },
        authenticator: {
            create: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
    },
}));

// Mock next/headers: las server actions llaman headers() fuera de un
// request scope real durante los tests.
jest.mock('next/headers', () => ({
    headers: jest.fn(async () => new Headers({ host: 'localhost:3000' })),
}));

// revalidatePath requiere el store de Next en runtime; en tests es un no-op.
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
    revalidateTag: jest.fn(),
}));

// Mock SimpleWebAuthn
jest.mock('@simplewebauthn/server', () => ({
    generateRegistrationOptions: jest.fn(),
    verifyRegistrationResponse: jest.fn(),
    generateAuthenticationOptions: jest.fn(),
    verifyAuthenticationResponse: jest.fn(),
}));



describe('WebAuthn Server Actions', () => {
    const mockEmployee = {
        id: 'emp-123',
        firstName: 'John',
        lastName: 'Doe',
        cedula: '8-888-8888',
        clientId: 'client-1',
        authenticators: []
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateRegisterOptions', () => {
        it('should generate options and store challenge', async () => {
            (prisma.paydayEmployee.findUnique as jest.Mock).mockResolvedValue(mockEmployee);
            (SimpleWebAuthn.generateRegistrationOptions as jest.Mock).mockResolvedValue({
                challenge: 'mock-challenge',
                timeout: 60000
            });

            const result = await generateRegisterOptions('emp-123', 'client-1');

            expect(prisma.paydayEmployee.findUnique).toHaveBeenCalledWith({
                where: { id: 'emp-123', clientId: 'client-1' },
                include: { authenticators: true }
            });
            expect(SimpleWebAuthn.generateRegistrationOptions).toHaveBeenCalled();
            expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
                create: expect.objectContaining({ value: 'mock-challenge' })
            }));
            expect(result).toEqual({ challenge: 'mock-challenge', timeout: 60000 });
        });
    });

    describe('verifyRegistration', () => {
        it('should verify and save authenticator', async () => {
            (prisma.paydayEmployee.findUnique as jest.Mock).mockResolvedValue(mockEmployee);
            (prisma.systemConfig.findUnique as jest.Mock).mockResolvedValue({ value: 'mock-challenge' });
            (SimpleWebAuthn.verifyRegistrationResponse as jest.Mock).mockResolvedValue({
                verified: true,
                registrationInfo: {
                    credentialID: Buffer.from('cred-id'),
                    credentialPublicKey: Buffer.from('pub-key'),
                    counter: 0,
                    credentialDeviceType: 'singleDevice',
                    credentialBackedUp: false
                }
            });

            const response = { response: { clientDataJSON: '...', attestationObject: '...' } };
            await verifyRegistration('emp-123', 'client-1', response);

            expect((prisma as any).authenticator.create).toHaveBeenCalled();
            expect(prisma.systemConfig.delete).toHaveBeenCalled();
        });
    });
});
