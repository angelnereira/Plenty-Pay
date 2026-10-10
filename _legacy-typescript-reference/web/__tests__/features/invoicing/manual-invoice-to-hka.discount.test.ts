/**
 * Regression test for HKA item-level discount bug.
 *
 * Bug:
 *   El payload incluía `totalDescuento` con la suma de descuentos por-ítem
 *   sin incluir `listaDescBonificacion`, lo que causaba el error de HKA:
 *     "Debe informar el campo listaDescBonificacion. El campo
 *      totalDescuento fue informado."
 *
 * Regla HKA aplicada:
 *   - Descuentos por-ítem ya viajan en `precioUnitarioDescuento` (precio neto
 *     unitario). Por tanto: `precioItem = cantidad * precioUnitarioDescuento`.
 *     `totalDescuento` debe omitirse.
 *   - `totalDescuento` solo se usa para descuentos globales (bonificación),
 *     y entonces requiere `listaDescBonificacion`.
 */

import {
    mapManualInvoiceToHKARequest,
    type ManualInvoiceData,
} from '@/lib/mappers/manual-invoice-to-hka';
import type { InvoiceConfig } from '@/app/actions/invoice/get-invoice-config.action';

const baseConfig: InvoiceConfig = {
    company: {
        ruc: '155555555-2-2017',
        digitoVerificador: '00',
        razonSocial: 'Empresa Demo S.A.',
        nombreComercial: 'Empresa Demo',
        direccion: 'Calle 1, Ciudad',
        codigoUbicacion: '8-8-8',
        provincia: 'Panamá',
        distrito: 'Panamá',
        corregimiento: 'Bella Vista',
        telefono: '5550000',
        correo: 'demo@example.com',
    },
    billing: {
        tipoEmision: '01',
        destinoOperacion: '1',
        formatoCAFE: '1',
    },
    hka: {
        puntoFacturacionFiscal: '001',
    },
} as unknown as InvoiceConfig;

const buildData = (overrides?: Partial<ManualInvoiceData>): ManualInvoiceData => ({
    client: {
        tipoClienteFE: '02',
        tipoContribuyente: '1',
        numeroRUC: '8-NT-1-1234',
        digitoVerificadorRUC: '00',
        razonSocial: 'Consumidor Final',
        direccion: 'N/A',
        codigoUbicacion: '8-8-8',
        provincia: 'Panamá',
        distrito: 'Panamá',
        corregimiento: 'Bella Vista',
    },
    items: [
        {
            id: 'i1',
            descripcion: 'iPhone 14 Pro Max',
            cantidad: 3,
            precioUnitario: 63.95,
            // precio neto unitario (después de descuento)
            precioUnitarioDescuento: 43.95,
            tasaITBMS: '01',
            // El precio neto por ítem: 3 * 43.95 = 131.85
            precioItem: 131.85,
            valorITBMS: 9.23,
            valorTotal: 141.08,
        },
    ],
    payment: {
        formaPagoFact: '02',
        descFormaPago: '',
        tiempoPago: '1',
        informacionInteres: '',
    },
    ...overrides,
});

describe('mapManualInvoiceToHKARequest - descuento por-ítem (regresión)', () => {
    it('omite totalDescuento cuando hay descuentos por-ítem', () => {
        const result = mapManualInvoiceToHKARequest(buildData(), baseConfig);

        expect(result.totalesSubTotales).toBeDefined();
        expect(
            (result.totalesSubTotales as unknown as Record<string, unknown>).totalDescuento
        ).toBeUndefined();
    });

    it('no incluye listaDescBonificacion (descuento por-ítem no la requiere)', () => {
        const result = mapManualInvoiceToHKARequest(buildData(), baseConfig);

        expect(
            (result.totalesSubTotales as unknown as Record<string, unknown>).listaDescBonificacion
        ).toBeUndefined();
    });

    it('precioItem refleja el precio neto: cantidad * precioUnitarioDescuento', () => {
        const result = mapManualInvoiceToHKARequest(buildData(), baseConfig);

        const item = result.listaItems[0];
        expect(parseFloat(item.precioItem)).toBeCloseTo(131.85, 2);
    });

    it('valorITBMS se calcula sobre el precio ya descontado', () => {
        const result = mapManualInvoiceToHKARequest(buildData(), baseConfig);

        const item = result.listaItems[0];
        // 7% de 131.85 ≈ 9.23
        expect(parseFloat(item.valorITBMS)).toBeCloseTo(9.23, 2);
    });

    it('si no hay descuento (precio neto = precio unitario), no colapsa el item a 0.00', () => {
        const data = buildData({
            items: [
                {
                    id: 'no-discount',
                    descripcion: 'Caja de Calzados nike',
                    cantidad: 8,
                    precioUnitario: 29.99,
                    precioUnitarioDescuento: 29.99,
                    tasaITBMS: '01',
                    precioItem: 239.92,
                    valorITBMS: 16.79,
                    valorTotal: 256.71,
                },
            ],
        });

        const result = mapManualInvoiceToHKARequest(data, baseConfig);
        const item = result.listaItems[0];

        expect(parseFloat(item.precioItem)).toBeCloseTo(239.92, 2);
        expect(parseFloat(item.valorTotal)).toBeCloseTo(256.71, 2);
    });

    it('totalPrecioNeto suma todos los precioItem (post-descuento)', () => {
        const data = buildData({
            items: [
                {
                    id: 'a',
                    descripcion: 'Item A',
                    cantidad: 2,
                    precioUnitario: 500,
                    // precio neto unitario
                    precioUnitarioDescuento: 400,
                    tasaITBMS: '01',
                    precioItem: 800, // 2 * 400
                    valorITBMS: 56,
                    valorTotal: 856,
                },
                {
                    id: 'b',
                    descripcion: 'Item B',
                    cantidad: 1,
                    precioUnitario: 1000,
                    precioUnitarioDescuento: 1000,
                    tasaITBMS: '01',
                    precioItem: 1000,
                    valorITBMS: 70,
                    valorTotal: 1070,
                },
            ],
        });

        const result = mapManualInvoiceToHKARequest(data, baseConfig);

        expect(parseFloat(result.totalesSubTotales.totalPrecioNeto)).toBeCloseTo(1800, 2);
        expect(parseFloat(result.totalesSubTotales.totalITBMS)).toBeCloseTo(126, 2);
        expect(parseFloat(result.totalesSubTotales.totalFactura)).toBeCloseTo(1926, 2);
        expect(
            (result.totalesSubTotales as unknown as Record<string, unknown>).totalDescuento
        ).toBeUndefined();
    });
});
