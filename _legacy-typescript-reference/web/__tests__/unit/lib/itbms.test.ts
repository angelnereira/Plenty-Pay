/**
 * Tests de lib/fiscal/itbms.ts — el acumulador fiscal de ITBMS ("recaudación").
 *
 * Verifica que el cómputo solo considera facturas de venta emitidas con éxito,
 * excluyendo notas de crédito/débito, reembolsos, ventas internas y documentos
 * en error/anulados. Es un tema fiscal: el filtro debe ser exacto.
 */

// Mock del cliente Prisma usado por el helper.
const aggregateMock = jest.fn();
const queryRawMock = jest.fn();

jest.mock('@core/database', () => ({
    prisma: {
        invoice: {
            aggregate: (...args: unknown[]) => aggregateMock(...args),
        },
        $queryRaw: (...args: unknown[]) => queryRawMock(...args),
    },
}));

import {
    getAccumulatedItbms,
    getItbmsMonthlyBreakdown,
    SUCCESSFUL_FISCAL_STATUSES,
    SALES_DOCUMENT_TYPES,
} from '@/lib/fiscal/itbms';

describe('lib/fiscal/itbms — constantes', () => {
    it('solo cuenta estados de emisión fiscal exitosa (EMITTED/CERTIFIED)', () => {
        expect(SUCCESSFUL_FISCAL_STATUSES).toEqual(['EMITTED', 'CERTIFIED']);
        // No debe incluir estados que no son emisión fiscal exitosa.
        for (const bad of ['INTERNAL', 'DRAFT', 'PROCESSING', 'QUEUED', 'ERROR', 'REJECTED', 'CANCELLED']) {
            expect(SUCCESSFUL_FISCAL_STATUSES).not.toContain(bad);
        }
    });

    it('solo cuenta documentos de venta, excluyendo notas y reembolsos', () => {
        expect(SALES_DOCUMENT_TYPES).toContain('FACTURA');
        for (const excluded of ['NOTA_CREDITO', 'NOTA_DEBITO', 'REEMBOLSO']) {
            expect(SALES_DOCUMENT_TYPES).not.toContain(excluded);
        }
    });
});

describe('getAccumulatedItbms', () => {
    beforeEach(() => jest.clearAllMocks());

    it('agrega SUM(itbms) con el filtro fiscal correcto y devuelve número', async () => {
        aggregateMock.mockResolvedValue({ _sum: { itbms: 1234.56 } });

        const total = await getAccumulatedItbms({ clientId: 'client-1' });

        expect(total).toBe(1234.56);
        expect(aggregateMock).toHaveBeenCalledTimes(1);

        const arg = aggregateMock.mock.calls[0][0];
        expect(arg._sum).toEqual({ itbms: true });
        expect(arg.where.clientId).toBe('client-1');
        expect(arg.where.status).toEqual({ in: ['EMITTED', 'CERTIFIED'] });
        expect(arg.where.documentType.in).toContain('FACTURA');
        expect(arg.where.documentType.in).not.toContain('NOTA_CREDITO');
        // Sin rango de fechas no debe filtrar por issueDate (acumulado histórico).
        expect(arg.where.issueDate).toBeUndefined();
    });

    it('aplica filtro de fecha cuando se pasa from/to (reporte por periodo)', async () => {
        aggregateMock.mockResolvedValue({ _sum: { itbms: 0 } });

        await getAccumulatedItbms({ clientId: 'c', from: '2026-01-01', to: '2026-01-31' });

        const arg = aggregateMock.mock.calls[0][0];
        expect(arg.where.issueDate.gte).toBeInstanceOf(Date);
        expect(arg.where.issueDate.lte).toBeInstanceOf(Date);
    });

    it('devuelve 0 cuando no hay facturas (suma nula)', async () => {
        aggregateMock.mockResolvedValue({ _sum: { itbms: null } });
        expect(await getAccumulatedItbms({ clientId: 'c' })).toBe(0);
    });

    it('nunca rompe la vista: devuelve 0 ante error de DB', async () => {
        aggregateMock.mockRejectedValue(new Error('db down'));
        expect(await getAccumulatedItbms({ clientId: 'c' })).toBe(0);
    });
});

describe('getItbmsMonthlyBreakdown', () => {
    beforeEach(() => jest.clearAllMocks());

    it('mapea filas crudas a números (mes, conteo, base, itbms)', async () => {
        queryRawMock.mockResolvedValue([
            { month: '2026-01', invoice_count: 3, taxable_base: 100, itbms: 7 },
            { month: '2026-02', invoice_count: 5, taxable_base: 200, itbms: 14 },
        ]);

        const rows = await getItbmsMonthlyBreakdown({ clientId: 'c', from: '2026-01-01', to: '2026-02-28' });

        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({ month: '2026-01', invoiceCount: 3, taxableBase: 100, itbms: 7 });
        expect(queryRawMock).toHaveBeenCalledTimes(1);
        // El argumento debe ser un Prisma.Sql parametrizado (objeto con `values`),
        // no un string crudo concatenado — evita inyección SQL.
        const sqlArg = queryRawMock.mock.calls[0][0];
        expect(typeof sqlArg).toBe('object');
        expect(Array.isArray(sqlArg.values)).toBe(true);
    });
});
