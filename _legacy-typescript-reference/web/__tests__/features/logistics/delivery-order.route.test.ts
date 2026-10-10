/**
 * @jest-environment node
 *
 * Los route handlers son código de servidor: en jsdom no existe
 * Response.json() estático (lo usa NextResponse.json).
 */
// NOTA: no importar 'jest' desde @jest/globals — rompe el hoisting de jest.mock con next/jest (SWC). Se usan los globals inyectados.

// Mock auth before route import
jest.mock('@core/auth', () => ({
    auth: jest.fn(),
}));

// Mock service before route import
jest.mock('@/features/logistics/model/services/delivery-order.service', () => ({
    createFromInvoice: jest.fn(),
}));

import { POST } from '@/app/api/logistics/orders/from-invoice/route';
import { auth } from '@core/auth';
import { createFromInvoice } from '@/features/logistics/model/services/delivery-order.service';

const mockedAuth = auth as jest.MockedFunction<typeof auth>;
const mockedCreateFromInvoice = createFromInvoice as jest.MockedFunction<typeof createFromInvoice>;

describe('Logistics from-invoice Route', () => {
    const mockSession = {
        user: {
            id: 'user-123',
            clientId: 'client-456',
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if user is not authenticated', async () => {
            // @ts-expect-error Mocking auth method
            mockedAuth.mockResolvedValue(null);

        const request = new Request('http://localhost/api/logistics/orders/from-invoice', {
            method: 'POST',
            body: JSON.stringify({ invoiceId: 'inv-1' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('No autorizado');
    });

    it('should create order successfully from invoice (happy path)', async () => {
            // @ts-expect-error Mocking auth method with partial session
            mockedAuth.mockResolvedValue(mockSession);
            mockedCreateFromInvoice.mockResolvedValue({ id: 'oe-1', code: 'OE-001' });

        const request = new Request('http://localhost/api/logistics/orders/from-invoice', {
            method: 'POST',
            body: JSON.stringify({ invoiceId: 'inv-1' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.code).toBe('OE-001');
        expect(createFromInvoice).toHaveBeenCalledWith(
            'client-456',
            'user-123',
            expect.objectContaining({ invoiceId: 'inv-1' })
        );
    });

    it('should return 422 if invoiceId is missing', async () => {
            // @ts-expect-error Mocking auth method with partial session
            mockedAuth.mockResolvedValue(mockSession);

        const request = new Request('http://localhost/api/logistics/orders/from-invoice', {
            method: 'POST',
            body: JSON.stringify({ something: 'else' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.error).toBe('Datos inválidos');
    });

    it('should return 500 if service throws error', async () => {
            // @ts-expect-error Mocking auth method with partial session
            mockedAuth.mockResolvedValue(mockSession);
            mockedCreateFromInvoice.mockRejectedValue(new Error('Service failure'));

        const request = new Request('http://localhost/api/logistics/orders/from-invoice', {
            method: 'POST',
            body: JSON.stringify({ invoiceId: 'inv-1' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe('Service failure');
    });
});
