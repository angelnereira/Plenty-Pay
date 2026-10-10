/**
 * Regression test for POS sale → HKA discount fix.
 *
 * Bug:
 *   El POS aplicaba descuento global (PERCENTAGE/FIXED) y lo distribuía
 *   proporcionalmente por línea, pero NO persistía `discount` en
 *   `InvoiceItem`. El mapper HKA (invoice-to-hka.ts) leía
 *   `item.discount || 0` → siempre 0 → enviaba `precioUnitarioDescuento:
 *   "0.00"` a la DGI. Resultado: el comercio cobraba al cliente con
 *   descuento pero emitía la factura fiscal sin él.
 *
 * Fix:
 *   `process-sale.action.ts` ahora persiste `discount: itemDiscount`
 *   en cada línea (Opción A: descuento por-ítem que reduce la base
 *   imponible del ITBMS, alineado con HKA Panamá).
 *
 * Este test documenta:
 *   1. Contrato matemático del prorrateo (suma de discounts = descuento total).
 *   2. Aritmética HKA (precioItem, valorITBMS, valorTotal) cuando viene un
 *      InvoiceItem con descuento por línea.
 *   3. Que el campo `precioUnitarioDescuento` se calcula como `discount /
 *      cantidad`.
 */

import {
    calcularPrecioItem,
    calcularITBMS,
    calcularValorTotal,
    roundToTwo,
} from '@/features/hka/model/services/utils';

// ============================================================================
// 1. CONTRATO DEL PRORRATEO + COMBINACIÓN LINE/GLOBAL
// ============================================================================
//
// Reproduce la lógica de process-sale.action.ts: cada línea recibe su propio
// descuento (lineDiscount) más una porción prorrateada del descuento global.
// Si esta función cambia, estos tests deben ajustarse a la par.

type Discount = { type: 'PERCENTAGE' | 'FIXED'; value: number } | null | undefined;

interface PosCartLike {
    id: string;
    price: number;
    quantity: number;
    sku?: string;
    name: string;
    lineDiscount?: Discount;
}

function resolveLineDiscount(item: PosCartLike): number {
    if (!item.lineDiscount) return 0;
    const lineSubtotal = item.price * item.quantity;
    if (item.lineDiscount.type === 'PERCENTAGE') {
        const pct = Math.min(Math.max(item.lineDiscount.value, 0), 100);
        return lineSubtotal * (pct / 100);
    }
    return Math.min(Math.max(item.lineDiscount.value, 0), lineSubtotal);
}

function proratePOSDiscount(cart: PosCartLike[], discount: Discount) {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const lineDiscountTotal = cart.reduce((acc, item) => acc + resolveLineDiscount(item), 0);
    const baseAfterLine = Math.max(subtotal - lineDiscountTotal, 0);

    let globalDiscountAmount = 0;
    if (discount) {
        if (discount.type === 'PERCENTAGE') {
            const pct = Math.min(Math.max(discount.value, 0), 100);
            globalDiscountAmount = baseAfterLine * (pct / 100);
        } else {
            globalDiscountAmount = Math.min(Math.max(discount.value, 0), baseAfterLine);
        }
    }

    return cart.map((item) => {
        const itemSubtotal = item.price * item.quantity;
        const lineDisc = resolveLineDiscount(item);
        const lineSubtotalAfter = itemSubtotal - lineDisc;
        const ratio = baseAfterLine > 0 ? lineSubtotalAfter / baseAfterLine : 0;
        const itemGlobalShare = globalDiscountAmount * ratio;
        const itemDiscount = lineDisc + itemGlobalShare;
        return {
            unitPrice: item.price,
            quantity: item.quantity,
            discount: itemDiscount,
            subtotal: itemSubtotal,
        };
    });
}

describe('POS: prorrateo de descuento por-ítem (contrato process-sale.action.ts)', () => {
    const cart = [
        { id: 'a', sku: 'A', name: 'Producto A', price: 100, quantity: 1 },
        { id: 'b', sku: 'B', name: 'Producto B', price: 200, quantity: 2 },
    ];

    it('descuento por porcentaje: la suma de discounts por-ítem = descuento total', () => {
        const items = proratePOSDiscount(cart, { type: 'PERCENTAGE', value: 10 });
        const sumDiscounts = items.reduce((s, i) => s + i.discount, 0);

        expect(sumDiscounts).toBeCloseTo(50, 4); // 10% de 500
    });

    it('descuento fijo en B/.: la suma se distribuye según el peso del subtotal', () => {
        const items = proratePOSDiscount(cart, { type: 'FIXED', value: 50 });

        expect(items[0].discount).toBeCloseTo(10, 4); // 100/500 * 50
        expect(items[1].discount).toBeCloseTo(40, 4); // 400/500 * 50
        expect(items[0].discount + items[1].discount).toBeCloseTo(50, 4);
    });

    it('sin descuento: discount por línea es 0', () => {
        const items = proratePOSDiscount(cart, null);
        expect(items.every((i) => i.discount === 0)).toBe(true);
    });

    it('carrito vacío no rompe (subtotal = 0)', () => {
        const items = proratePOSDiscount([], { type: 'PERCENTAGE', value: 10 });
        expect(items).toHaveLength(0);
    });

    it('descuento por LÍNEA solo: cada item recibe su propio descuento, los otros 0', () => {
        const items = proratePOSDiscount(
            [
                { id: 'a', sku: 'A', name: 'A', price: 100, quantity: 1, lineDiscount: { type: 'FIXED', value: 25 } },
                { id: 'b', sku: 'B', name: 'B', price: 200, quantity: 2 },
            ],
            null
        );

        expect(items[0].discount).toBeCloseTo(25, 4);
        expect(items[1].discount).toBeCloseTo(0, 4);
    });

    it('descuento POR LÍNEA + GLOBAL combinados: el global se prorratea sobre el subtotal post-line', () => {
        // Item A: 100 con 10% línea (= -10) → queda 90
        // Item B: 400 sin línea → queda 400
        // baseAfterLine = 490
        // Global 10% = 49 prorrateado: 49 × (90/490) = 9, 49 × (400/490) = 40
        // Discount A = 10 + 9 = 19; B = 0 + 40 = 40
        const items = proratePOSDiscount(
            [
                { id: 'a', sku: 'A', name: 'A', price: 100, quantity: 1, lineDiscount: { type: 'PERCENTAGE', value: 10 } },
                { id: 'b', sku: 'B', name: 'B', price: 200, quantity: 2 },
            ],
            { type: 'PERCENTAGE', value: 10 }
        );

        expect(items[0].discount).toBeCloseTo(19, 4);
        expect(items[1].discount).toBeCloseTo(40, 4);
        // Suma = 59 = lineTotal(10) + globalAfterLine(490 × 10% = 49)
        expect(items[0].discount + items[1].discount).toBeCloseTo(59, 4);
    });

    it('descuento línea PERCENTAGE > 100% se capa al 100% (no genera negativos)', () => {
        const items = proratePOSDiscount(
            [{ id: 'a', sku: 'A', name: 'A', price: 100, quantity: 1, lineDiscount: { type: 'PERCENTAGE', value: 250 } }],
            null
        );
        expect(items[0].discount).toBeCloseTo(100, 4);
    });

    it('descuento línea FIXED > subtotal se capa al subtotal de la línea', () => {
        const items = proratePOSDiscount(
            [{ id: 'a', sku: 'A', name: 'A', price: 100, quantity: 1, lineDiscount: { type: 'FIXED', value: 200 } }],
            null
        );
        expect(items[0].discount).toBeCloseTo(100, 4);
    });
});

// ============================================================================
// 2. CONTRATO HKA: InvoiceItem.discount → precioUnitarioDescuento + ITBMS
// ============================================================================
//
// Reproduce la aritmética de invoice-to-hka.ts:mapSingleItem (líneas 342-364).
// `item.discount` en BD es el descuento TOTAL de la línea (= cantidad ×
// descuento_unitario). El mapper lo divide entre `cantidad` para obtener el
// descuento por unidad que HKA espera en `precioUnitarioDescuento`.

describe('HKA: InvoiceItem.discount → precioUnitarioDescuento (contrato mapper)', () => {
    it('item con descuento: precioItem se reduce y el ITBMS se calcula post-descuento', () => {
        // Caso típico tras prorrateo: Item B del POS con discount=40.
        const cantidad = 2;
        const precioUnitario = 200;
        const descuentoTotal = 40; // = item.discount persistido en BD
        const descuentoUnitario = descuentoTotal / cantidad; // = 20

        const precioItem = roundToTwo(
            calcularPrecioItem(cantidad, precioUnitario, descuentoUnitario)
        );
        // = 2 × (200 - 20) = 360
        expect(precioItem).toBeCloseTo(360, 2);

        // ITBMS al 7% sobre el precio post-descuento (no sobre 400)
        const valorITBMS = roundToTwo(calcularITBMS(precioItem, '01'));
        expect(valorITBMS).toBeCloseTo(25.2, 2);

        const valorTotal = roundToTwo(calcularValorTotal(precioItem, valorITBMS));
        expect(valorTotal).toBeCloseTo(385.2, 2);
    });

    it('descuento = 0 mantiene la base imponible original', () => {
        const precioItem = roundToTwo(calcularPrecioItem(1, 100, 0));
        const valorITBMS = roundToTwo(calcularITBMS(precioItem, '01'));

        expect(precioItem).toBeCloseTo(100, 2);
        expect(valorITBMS).toBeCloseTo(7, 2); // 7% de 100
    });

    it('totales POS y HKA coinciden tras prorrateo (no hay drift fiscal)', () => {
        const cart = [
            { id: 'a', sku: 'A', name: 'A', price: 100, quantity: 1 },
            { id: 'b', sku: 'B', name: 'B', price: 200, quantity: 2 },
        ];

        // 1) POS prorratea descuento global de 50 B/.
        const items = proratePOSDiscount(cart, { type: 'FIXED', value: 50 });

        // 2) HKA mapper recalcula precioItem y valorITBMS por línea
        const totales = items.reduce(
            (acc, item) => {
                const descuentoUnitario = item.discount / item.quantity;
                const precioItem = roundToTwo(
                    calcularPrecioItem(item.quantity, item.unitPrice, descuentoUnitario)
                );
                const valorITBMS = roundToTwo(calcularITBMS(precioItem, '01'));
                return {
                    totalPrecioNeto: acc.totalPrecioNeto + precioItem,
                    totalITBMS: acc.totalITBMS + valorITBMS,
                };
            },
            { totalPrecioNeto: 0, totalITBMS: 0 }
        );

        // 3) Lo que el POS le cobra al cliente
        const subtotalPOS = 500;
        const subtotalAfterDiscountPOS = subtotalPOS - 50; // 450
        const taxPOS = subtotalAfterDiscountPOS * 0.07; // 31.5
        const totalPOS = subtotalAfterDiscountPOS + taxPOS; // 481.5

        // 4) Igualdad fiscal: lo cobrado al cliente = lo emitido a la DGI
        expect(roundToTwo(totales.totalPrecioNeto)).toBeCloseTo(subtotalAfterDiscountPOS, 2);
        expect(roundToTwo(totales.totalITBMS)).toBeCloseTo(taxPOS, 2);
        expect(roundToTwo(totales.totalPrecioNeto + totales.totalITBMS)).toBeCloseTo(
            totalPOS,
            2
        );
    });
});
