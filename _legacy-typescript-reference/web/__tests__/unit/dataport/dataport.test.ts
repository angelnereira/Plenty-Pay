/**
 * Tests del núcleo SDS/DataPort: registry, serializers, programación.
 */

// El registry importa providers (uno usa @core/database). Estos tests son
// puros (no tocan DB), así que stubeamos el cliente para evitar init de Prisma.
jest.mock('@core/database', () => ({ prismaServer: {}, prisma: {} }))

import { getDataset, allDatasets, capabilities, enabledModules, topoSort } from '@core/dataport/registry'
import { toCsv, deriveColumns } from '@core/dataport/serializers/csv'
import { toJson } from '@core/dataport/serializers/json'
import { computeNextRun, resolveWindow } from '@core/dataport/schedule'
import { isModuleEnabled } from '@core/dataport/module-map'

describe('DataPort registry', () => {
    it('registra datasets de los 7 módulos sin keys duplicadas', () => {
        const ds = allDatasets()
        expect(ds.length).toBeGreaterThanOrEqual(7)
        const keys = ds.map((d) => d.key)
        expect(new Set(keys).size).toBe(keys.length)
        expect(getDataset('invoices')).toBeDefined()
        expect(getDataset('products')?.importSpec).toBeDefined()
        expect(getDataset('credit_ledger')?.importSpec).toBeUndefined() // export-only (inmutable)
    })

    it('solo expone módulos habilitados por los flags del tenant', () => {
        const flags = { facturacionEnabled: true, inventoryEnabled: false }
        expect(isModuleEnabled('invoicing', flags)).toBe(true)
        expect(isModuleEnabled('inventory', flags)).toBe(false)
        expect(enabledModules(flags)).toEqual(['invoicing'])
    })

    it('capabilities marca enabled/importable correctamente', () => {
        const caps = capabilities({ invoicing: true } as Record<string, unknown>)
        const inv = caps.find((c) => c.module === 'invoicing')!
        expect(inv.enabled).toBe(false) // flag real es facturacionEnabled, no 'invoicing'
        const customers = inv.datasets.find((d) => d.key === 'customers')!
        expect(customers.importable).toBe(true)
    })

    it('topoSort ordena dependencias primero (invoices antes que invoice_items)', () => {
        const items = getDataset('invoice_items')!
        const inv = getDataset('invoices')!
        const sorted = topoSort([items, inv]).map((d) => d.key)
        expect(sorted.indexOf('invoices')).toBeLessThan(sorted.indexOf('invoice_items'))
    })
})

describe('DataPort serializers', () => {
    it('CSV es determinista y escapa comas/comillas', () => {
        const rows = [{ a: 1, b: 'x,y' }, { a: 2, b: 'he said "hi"' }]
        const out1 = toCsv(rows).toString('utf8')
        const out2 = toCsv(rows).toString('utf8')
        expect(out1).toBe(out2) // determinismo
        expect(out1).toContain('"x,y"')
        expect(out1).toContain('"he said ""hi"""')
    })

    it('deriveColumns une claves de todas las filas', () => {
        expect(deriveColumns([{ a: 1 }, { b: 2 }])).toEqual(['a', 'b'])
    })

    it('JSON incluye dataset, versión y filas', () => {
        const parsed = JSON.parse(toJson('products', '1', [{ sku: 'X' }]).toString('utf8'))
        expect(parsed.dataset).toBe('products')
        expect(parsed.version).toBe('1')
        expect(parsed.count).toBe(1)
        expect(parsed.rows[0].sku).toBe('X')
    })
})

describe('DataPort schedule', () => {
    it('computeNextRun DAILY devuelve una fecha futura', () => {
        const from = new Date('2026-06-01T10:00:00.000Z')
        const next = computeNextRun('DAILY', 6, {}, from)
        expect(next.getTime()).toBeGreaterThan(from.getTime())
        expect(next.getUTCHours()).toBe(6)
    })

    it('resolveWindow ROLLING_30D devuelve rango de ~30 días', () => {
        const w = resolveWindow('ROLLING_30D', new Date('2026-06-30T00:00:00.000Z'))
        expect(w.from).toBe('2026-06-01')
        expect(w.to).toBe('2026-06-30')
    })

    it('resolveWindow ALL no acota', () => {
        expect(resolveWindow('ALL')).toEqual({})
    })
})
