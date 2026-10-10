// Tests para los 9 mappers restantes (tipos 02-10)

import { facturaImportacionMapper } from '@/lib/mappers/strategies/factura-importacion.mapper';
import { notaCreditoGenericaMapper } from '@/lib/mappers/strategies/nota-credito-generica.mapper';
import { notaDebitoGenericaMapper } from '@/lib/mappers/strategies/nota-debito-generica.mapper';
import { zonaFrancaMapper } from '@/lib/mappers/strategies/zona-franca.mapper';
import { facturaExportacionMapper } from '@/lib/mappers/strategies/factura-exportacion.mapper';
import { notaCreditoReferenciadaMapper } from '@/lib/mappers/strategies/nota-credito-referenciada.mapper';
import { notaDebitoReferenciadaMapper } from '@/lib/mappers/strategies/nota-debito-referenciada.mapper';
import { reembolsoMapper } from '@/lib/mappers/strategies/reembolso.mapper';
import { extranjeraCompraMapper } from '@/lib/mappers/strategies/extranjera-compra.mapper';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeData(overrides: Record<string, unknown> = {}) {
    return {
        documentType: 'FACTURA' as const,
        client: {
            tipoClienteFE: '01',
            tipoContribuyente: '2',
            numeroRUC: '8-123-456',
            digitoVerificadorRUC: '5',
            razonSocial: 'Empresa Test S.A.',
            direccion: 'Calle 50, Ciudad de Panamá',
            codigoUbicacion: '8-8-1',
            provincia: 'Panamá',
            distrito: 'Panamá',
            corregimiento: 'San Felipe',
        },
        items: [{
            id: '1',
            descripcion: 'Servicio de consultoría',
            cantidad: 1,
            precioUnitario: 100,
            precioUnitarioDescuento: 100,
            tasaITBMS: '01',
            valorITBMS: 7,
            precioItem: 100,
            valorTotal: 107,
        }],
        payment: {
            formaPagoFact: '02',
            descFormaPago: '',
            tiempoPago: '1',
            informacionInteres: '',
        },
        ...overrides,
    };
}

function makeConfig() {
    return {
        hka: {
            codigoSucursalEmisor: '0000',
            tipoSucursal: '1' as const,
            puntoFacturacionFiscal: '001',
        },
        billing: {
            tipoEmision: '01' as const,
            destinoOperacion: '1' as const,
            formatoCAFE: '1' as const,
            entregaCAFE: '1' as const,
        },
    } as any;
}

// ─── Tipo 02: Importación ─────────────────────────────────────────────────────

describe('Mapper tipo 02 - Importación', () => {
    it('tipoDocumento es 02', () => {
        const doc = facturaImportacionMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoDocumento).toBe('02');
    });

    it('naturalezaOperacion es 21', () => {
        const doc = facturaImportacionMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.naturalezaOperacion).toBe('21');
    });

    it('tipoOperacion es 2 (Entrada)', () => {
        const doc = facturaImportacionMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoOperacion).toBe('2');
    });

    it('tipoDocumentoHKA es 02', () => {
        expect(facturaImportacionMapper.tipoDocumentoHKA).toBe('02');
    });
});

// ─── Tipo 06: NC Genérica ────────────────────────────────────────────────────

describe('Mapper tipo 06 - NC Genérica', () => {
    it('tipoDocumento es 06', () => {
        const doc = notaCreditoGenericaMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoDocumento).toBe('06');
    });

    it('naturalezaOperacion es 01', () => {
        const doc = notaCreditoGenericaMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.naturalezaOperacion).toBe('01');
    });

    it('NO tiene listaDocsFiscalReferenciados (prohibido para tipo 06)', () => {
        const doc = notaCreditoGenericaMapper.build(makeData(), makeConfig());
        expect(doc.listaDocsFiscalReferenciados).toBeUndefined();
    });

    it('tipoDocumentoHKA es 06', () => {
        expect(notaCreditoGenericaMapper.tipoDocumentoHKA).toBe('06');
    });
});

// ─── Tipo 07: ND Genérica ────────────────────────────────────────────────────

describe('Mapper tipo 07 - ND Genérica', () => {
    it('tipoDocumento es 07', () => {
        const doc = notaDebitoGenericaMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoDocumento).toBe('07');
    });

    it('naturalezaOperacion es 01', () => {
        const doc = notaDebitoGenericaMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.naturalezaOperacion).toBe('01');
    });

    it('NO tiene listaDocsFiscalReferenciados (prohibido para tipo 07)', () => {
        const doc = notaDebitoGenericaMapper.build(makeData(), makeConfig());
        expect(doc.listaDocsFiscalReferenciados).toBeUndefined();
    });

    it('tipoDocumentoHKA es 07', () => {
        expect(notaDebitoGenericaMapper.tipoDocumentoHKA).toBe('07');
    });
});

// ─── Tipo 08: Zona Franca ────────────────────────────────────────────────────

describe('Mapper tipo 08 - Zona Franca', () => {
    it('tipoDocumento es 08', () => {
        const doc = zonaFrancaMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoDocumento).toBe('08');
    });

    it('todos los items tienen tasaITBMS 00 (exentos)', () => {
        // Item con tasaITBMS=01 debe quedar como 00 en Zona Franca
        const doc = zonaFrancaMapper.build(makeData(), makeConfig());
        doc.listaItems.forEach(item => expect(item.tasaITBMS).toBe('00'));
    });

    it('todos los items tienen valorITBMS 0.00', () => {
        const doc = zonaFrancaMapper.build(makeData(), makeConfig());
        doc.listaItems.forEach(item => expect(parseFloat(item.valorITBMS)).toBe(0));
    });

    it('tipoDocumentoHKA es 08', () => {
        expect(zonaFrancaMapper.tipoDocumentoHKA).toBe('08');
    });
});

// ─── Tipo 03: Exportación ────────────────────────────────────────────────────

describe('Mapper tipo 03 - Exportación', () => {
    it('tipoDocumento es 03', () => {
        const doc = facturaExportacionMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoDocumento).toBe('03');
    });

    it('todos los items tienen tasaITBMS 00 (exentos)', () => {
        const doc = facturaExportacionMapper.build(makeData(), makeConfig());
        doc.listaItems.forEach(item => expect(item.tasaITBMS).toBe('00'));
    });

    it('destinoOperacion es 2 (Extranjero)', () => {
        const doc = facturaExportacionMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.destinoOperacion).toBe('2');
    });

    it('incluye grupoExportacion cuando hay exportData', () => {
        const data = makeData({
            exportData: {
                incoterm: 'FOB',
                port: 'Colón',
                currency: 'USD',
            }
        });
        const doc = facturaExportacionMapper.build(data, makeConfig());
        expect(doc.grupoExportacion).toBeDefined();
        expect(doc.grupoExportacion!.cCondEntr).toBe('FOB');
        expect(doc.grupoExportacion!.dPuertoEmbarq).toBe('Colón');
    });

    it('NO incluye grupoExportacion cuando no hay exportData', () => {
        const doc = facturaExportacionMapper.build(makeData(), makeConfig());
        expect(doc.grupoExportacion).toBeUndefined();
    });

    it('tipoDocumentoHKA es 03', () => {
        expect(facturaExportacionMapper.tipoDocumentoHKA).toBe('03');
    });
});

// ─── Tipo 04: NC Referenciada ────────────────────────────────────────────────

describe('Mapper tipo 04 - NC Referenciada', () => {
    it('tipoDocumento es 04', () => {
        const doc = notaCreditoReferenciadaMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoDocumento).toBe('04');
    });

    it('lanza error si referenceData tiene fecha > 180 días', () => {
        const data = makeData({
            referenceData: {
                cufe: 'A'.repeat(66),
                fechaEmision: new Date(Date.now() - 181 * 24 * 60 * 60 * 1000).toISOString(),
            }
        });
        expect(() => notaCreditoReferenciadaMapper.build(data, makeConfig())).toThrow('180');
    });

    it('NO lanza error si referenceData tiene fecha <= 180 días', () => {
        const data = makeData({
            referenceData: {
                cufe: 'A'.repeat(66),
                fechaEmision: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            }
        });
        expect(() => notaCreditoReferenciadaMapper.build(data, makeConfig())).not.toThrow();
    });

    it('incluye listaDocsFiscalReferenciados cuando hay referenceData', () => {
        const cufe = 'A'.repeat(66);
        const data = makeData({
            referenceData: {
                cufe,
                fechaEmision: new Date().toISOString(),
            }
        });
        const doc = notaCreditoReferenciadaMapper.build(data, makeConfig()) as any;
        expect(doc.listaDocsFiscalReferenciados).toBeDefined();
        expect(doc.listaDocsFiscalReferenciados[0].cufeFEReferenciada).toBe(cufe);
    });

    it('NO tiene listaDocsFiscalReferenciados si no hay referenceData', () => {
        const doc = notaCreditoReferenciadaMapper.build(makeData(), makeConfig());
        expect(doc.listaDocsFiscalReferenciados).toBeUndefined();
    });

    it('tipoDocumentoHKA es 04', () => {
        expect(notaCreditoReferenciadaMapper.tipoDocumentoHKA).toBe('04');
    });
});

// ─── Tipo 05: ND Referenciada ────────────────────────────────────────────────

describe('Mapper tipo 05 - ND Referenciada', () => {
    it('tipoDocumento es 05', () => {
        const doc = notaDebitoReferenciadaMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoDocumento).toBe('05');
    });

    it('lanza error si referenceData tiene fecha > 180 días', () => {
        const data = makeData({
            referenceData: {
                cufe: 'B'.repeat(66),
                fechaEmision: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
            }
        });
        expect(() => notaDebitoReferenciadaMapper.build(data, makeConfig())).toThrow('180');
    });

    it('incluye listaDocsFiscalReferenciados cuando hay referenceData', () => {
        const cufe = 'B'.repeat(66);
        const data = makeData({
            referenceData: {
                cufe,
                fechaEmision: new Date().toISOString(),
            }
        });
        const doc = notaDebitoReferenciadaMapper.build(data, makeConfig()) as any;
        expect(doc.listaDocsFiscalReferenciados).toBeDefined();
        expect(doc.listaDocsFiscalReferenciados[0].cufeFEReferenciada).toBe(cufe);
    });

    it('tipoDocumentoHKA es 05', () => {
        expect(notaDebitoReferenciadaMapper.tipoDocumentoHKA).toBe('05');
    });
});

// ─── Tipo 09: Reembolso ──────────────────────────────────────────────────────

describe('Mapper tipo 09 - Reembolso', () => {
    it('tipoDocumento es 09', () => {
        const doc = reembolsoMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoDocumento).toBe('09');
    });

    it('naturalezaOperacion es 01', () => {
        const doc = reembolsoMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.naturalezaOperacion).toBe('01');
    });

    it('item con rucTercero incluye info del tercero en la descripción', () => {
        const data = makeData({
            items: [{
                id: '1',
                descripcion: 'Gasto de transporte',
                cantidad: 1,
                precioUnitario: 50,
                precioUnitarioDescuento: 50,
                tasaITBMS: '01',
                valorITBMS: 3.5,
                precioItem: 50,
                valorTotal: 53.5,
                rucTercero: '8-999-999',
                numeroDocumentoTercero: 'FE-001234',
            }]
        });
        const doc = reembolsoMapper.build(data, makeConfig());
        expect(doc.listaItems[0].descripcion).toContain('8-999-999');
        expect(doc.listaItems[0].descripcion).toContain('FE-001234');
    });

    it('tipoDocumentoHKA es 09', () => {
        expect(reembolsoMapper.tipoDocumentoHKA).toBe('09');
    });
});

// ─── Tipo 10: Extranjera/Compra ──────────────────────────────────────────────

describe('Mapper tipo 10 - Extranjera/Compra', () => {
    it('tipoDocumento es 10', () => {
        const doc = extranjeraCompraMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoDocumento).toBe('10');
    });

    it('tipoOperacion es 2 (compra)', () => {
        const doc = extranjeraCompraMapper.build(makeData(), makeConfig());
        expect(doc.datosTransaccion.tipoOperacion).toBe('2');
    });

    it('usa compraData como cliente cuando está disponible', () => {
        const data = makeData({
            compraData: {
                cedulaProveedor: '9-876-543',
                nombreProveedor: 'Juan Proveedor',
            }
        });
        const doc = extranjeraCompraMapper.build(data, makeConfig());
        const cliente = doc.datosTransaccion.cliente as any;
        expect(cliente.numeroRUC).toBe('9-876-543');
        expect(cliente.razonSocial).toBe('Juan Proveedor');
    });

    it('info del proveedor aparece en informacionInteres cuando hay compraData', () => {
        const data = makeData({
            compraData: {
                cedulaProveedor: '9-876-543',
                nombreProveedor: 'Juan Proveedor',
            }
        });
        const doc = extranjeraCompraMapper.build(data, makeConfig());
        expect(doc.datosTransaccion.informacionInteres).toContain('Juan Proveedor');
    });

    it('tipoDocumentoHKA es 10', () => {
        expect(extranjeraCompraMapper.tipoDocumentoHKA).toBe('10');
    });
});
