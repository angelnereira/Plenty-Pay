/**
 * Tests para los cálculos de pos.store con descuentos por-línea + global
 * combinados. Estos tests blindan el contrato de:
 *   - getSubtotal (PRE descuentos)
 *   - getLineDiscountAmount (suma de descuentos por línea)
 *   - getDiscountAmount (descuento global aplicado sobre subtotal − line)
 *   - getTaxAmount (ITBMS post-descuentos)
 *   - getTotal (subtotal − descuentos + ITBMS)
 *
 * Aritmética HKA esperada:
 *   precioItem = (price × qty) − lineDisc − globalShare
 *   ITBMS = (subtotal − allDiscounts) × 0.07
 */

import { usePosStore } from '@/features/pos/stores/pos.store';
import type { PosProduct } from '@/features/pos/stores/pos.store';

// Reset del store entre tests porque es un singleton.
afterEach(() => {
    usePosStore.getState().clearCart();
    usePosStore.getState().setDiscount(null);
});

const productA: PosProduct = {
    id: 'a',
    name: 'Producto A',
    price: 100,
    taxRate: 0.07,
    stock: 10,
};
const productB: PosProduct = {
    id: 'b',
    name: 'Producto B',
    price: 200,
    taxRate: 0.07,
    stock: 10,
};

describe('pos.store: descuentos combinados', () => {
    it('sin descuentos: ITBMS sobre subtotal completo', () => {
        const store = usePosStore.getState();
        store.addToCart(productA); // 100
        store.addToCart(productB); // 200
        // updateQuantity para B = 2 (subtotal 400)
        store.updateQuantity(productB.id, 2);

        const s = usePosStore.getState();
        expect(s.getSubtotal()).toBeCloseTo(500, 2);
        expect(s.getLineDiscountAmount()).toBeCloseTo(0, 2);
        expect(s.getDiscountAmount()).toBeCloseTo(0, 2);
        expect(s.getTaxAmount()).toBeCloseTo(35, 2); // 500 × 7%
        expect(s.getTotal()).toBeCloseTo(535, 2);
    });

    it('descuento por-línea PERCENTAGE: ITBMS solo sobre el monto remanente', () => {
        const store = usePosStore.getState();
        store.addToCart(productA);
        store.setLineDiscount(productA.id, { type: 'PERCENTAGE', value: 20 }); // 20% sobre 100

        const s = usePosStore.getState();
        expect(s.getSubtotal()).toBeCloseTo(100, 2);
        expect(s.getLineDiscountAmount()).toBeCloseTo(20, 2);
        expect(s.getTaxAmount()).toBeCloseTo(5.6, 2); // 80 × 7%
        expect(s.getTotal()).toBeCloseTo(85.6, 2);
    });

    it('descuento global FIXED + descuento por-línea coexisten sin doble cobro', () => {
        const store = usePosStore.getState();
        store.addToCart(productA); // 100
        store.addToCart(productB);
        store.updateQuantity(productB.id, 2); // 400
        // line A = 10 (FIXED) → A queda 90; subtotal post-line = 490
        store.setLineDiscount(productA.id, { type: 'FIXED', value: 10 });
        // global FIXED 49 sobre 490
        store.setDiscount({ type: 'FIXED', value: 49 });

        const s = usePosStore.getState();
        expect(s.getSubtotal()).toBeCloseTo(500, 2);
        expect(s.getLineDiscountAmount()).toBeCloseTo(10, 2);
        expect(s.getDiscountAmount()).toBeCloseTo(49, 2);
        // Taxable: 500 − 10 − 49 = 441
        expect(s.getTaxAmount()).toBeCloseTo(30.87, 2);
        expect(s.getTotal()).toBeCloseTo(471.87, 2);
    });

    it('descuento global PERCENTAGE > 100 se capa al 100% (no negativos)', () => {
        const store = usePosStore.getState();
        store.addToCart(productA);
        store.setDiscount({ type: 'PERCENTAGE', value: 250 });

        const s = usePosStore.getState();
        expect(s.getDiscountAmount()).toBeCloseTo(100, 2);
        expect(s.getTotal()).toBeCloseTo(0, 2);
    });

    it('descuento global FIXED > subtotal se capa al subtotal post-line', () => {
        const store = usePosStore.getState();
        store.addToCart(productA);
        store.setDiscount({ type: 'FIXED', value: 9999 });

        const s = usePosStore.getState();
        expect(s.getDiscountAmount()).toBeCloseTo(100, 2);
        expect(s.getTotal()).toBeCloseTo(0, 2);
    });

    it('quitar lineDiscount restaura el cálculo original', () => {
        const store = usePosStore.getState();
        store.addToCart(productA);
        store.setLineDiscount(productA.id, { type: 'FIXED', value: 30 });
        expect(usePosStore.getState().getTotal()).toBeCloseTo(74.9, 2);

        store.setLineDiscount(productA.id, null);
        expect(usePosStore.getState().getTotal()).toBeCloseTo(107, 2);
    });
});
