/**
 * Test del motor de export: scoping multi-tenant forzado + exclusión de campos
 * sensibles + normalización de valores.
 */

const findManyMock = jest.fn()

jest.mock('@core/database', () => ({
    prismaServer: {
        // delegate genérico accedido por (prisma as any)[model]
        invoice: { findMany: (...a: unknown[]) => findManyMock(...a), count: jest.fn() },
    },
}))

import { streamDataset, normalizeValue } from '@core/dataport/engine'
import type { DatasetDescriptor, TenantCtx } from '@core/dataport/contract'

const ctx: TenantCtx = { clientId: 'tenant-A', actorUserId: 'u', actorEmail: 'e', elevated: true }

const descriptor: DatasetDescriptor = {
    key: 'invoices', label: 'Facturas', module: 'invoicing', version: '1',
    sensitivity: 'fiscal', mutability: 'immutable', model: 'invoice',
    excludeFields: ['secret'],
}

describe('streamDataset', () => {
    beforeEach(() => jest.clearAllMocks())

    it('SIEMPRE filtra por clientId del ctx (anti cross-tenant) y excluye campos sensibles', async () => {
        findManyMock.mockResolvedValueOnce([{ id: '1', clientId: 'tenant-A', total: 5, secret: 'x' }])

        const rows: Record<string, unknown>[] = []
        for await (const r of streamDataset(descriptor, ctx, {})) rows.push(r)

        // El where debe incluir el clientId del ctx, no otro.
        const arg = findManyMock.mock.calls[0][0]
        expect(arg.where.clientId).toBe('tenant-A')
        expect(arg.orderBy).toEqual({ id: 'asc' })

        // Campo sensible excluido.
        expect(rows[0]).not.toHaveProperty('secret')
        expect(rows[0].id).toBe('1')
    })

    it('aplica filtro de período cuando hay periodField + from/to', async () => {
        findManyMock.mockResolvedValueOnce([])
        const d = { ...descriptor, periodField: 'issueDate' }
        for await (const _ of streamDataset(d, ctx, { from: '2026-01-01', to: '2026-01-31' })) { void _ }
        const arg = findManyMock.mock.calls[0][0]
        expect(arg.where.issueDate.gte).toBeInstanceOf(Date)
        expect(arg.where.issueDate.lte).toBeInstanceOf(Date)
    })
})

describe('normalizeValue', () => {
    it('convierte Date a ISO, Decimal a número y null a null', () => {
        expect(normalizeValue(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T00:00:00.000Z')
        expect(normalizeValue({ toNumber: () => 7.5 })).toBe(7.5)
        expect(normalizeValue(null)).toBeNull()
        expect(normalizeValue(10n)).toBe('10')
    })
})
