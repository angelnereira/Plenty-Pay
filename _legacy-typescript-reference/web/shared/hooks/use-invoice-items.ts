/**
 * useInvoiceItems Hook
 *
 * Manages invoice line items with add, remove, update operations.
 * Handles ITBMS calculations and totals automatically.
 * Supports inventory product linking, CPBS codes (government invoices),
 * and auto-population from referenced invoices (NC/ND).
 *
 * @module hooks/use-invoice-items
 */

'use client';

import { useState, useCallback, useMemo } from 'react';

// ============================================
// TYPES
// ============================================

export interface InvoiceItem {
    id: string;
    /** SKU o código interno del producto */
    codigo: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    precioUnitarioDescuento: number;
    tasaITBMS: '00' | '01' | '02' | '03';
    /** ID del producto en inventario. El backend usa este campo para descontar stock. */
    productId?: string;
    /** Código CPBS de 4 dígitos (obligatorio para facturas a Gobierno) */
    cpbsCode?: string;
    /** Unidad de medida CPBS (obligatorio para facturas a Gobierno) */
    cpbsUnit?: string;
    /** RUC del tercero (solo para tipo 09 - REEMBOLSO) */
    rucTercero?: string;
    /** Número de documento del tercero (solo para tipo 09 - REEMBOLSO) */
    numeroDocumentoTercero?: string;
    // Calculated fields
    subtotal: number;
    itbms: number;
    total: number;
}

export interface ItemTotals {
    subtotal: number;
    totalITBMS: number;
    totalDescuentos: number;
    totalGeneral: number;
    itemCount: number;
}

export interface AddItemInput {
    codigo?: string;
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    descuento?: number;
    tasaITBMS?: '00' | '01' | '02' | '03';
    productId?: string;
    cpbsCode?: string;
    cpbsUnit?: string;
    /** RUC del tercero (solo para tipo 09 - REEMBOLSO) */
    rucTercero?: string;
    /** Número de documento del tercero (solo para tipo 09 - REEMBOLSO) */
    numeroDocumentoTercero?: string;
}

/** Shape of an item from a referenced invoice (for NC/ND auto-population) */
export interface ReferencedInvoiceItem {
    id: string;
    code: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
}

export interface UseInvoiceItemsReturn {
    items: InvoiceItem[];
    totals: ItemTotals;
    addItem: (item: AddItemInput) => void;
    updateItem: (id: string, updates: Partial<AddItemInput>) => void;
    removeItem: (id: string) => void;
    clearItems: () => void;
    setItems: (items: InvoiceItem[]) => void;
    /** Load items from a referenced invoice (for NC/ND referenced mode) */
    loadFromReferencedInvoice: (items: ReferencedInvoiceItem[]) => void;
    getItemsForHKA: () => Array<{
        descripcion: string;
        codigo?: string;
        cantidad: string;
        precioUnitario: string;
        precioUnitarioDescuento: string;
        precioItem: string;
        valorTotal: string;
        tasaITBMS: string;
        valorITBMS: string;
        productId?: string;
        cpbsCode?: string;
        cpbsUnit?: string;
        rucTercero?: string;
        numeroDocumentoTercero?: string;
    }>;
}

// ============================================
// HELPERS
// ============================================

function generateId(): string {
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getITBMSRate(code: '00' | '01' | '02' | '03'): number {
    const rates: Record<string, number> = {
        '00': 0,
        '01': 0.07,
        '02': 0.10,
        '03': 0.15,
    };
    return rates[code] ?? 0.07;
}

/** Maps a numeric tax rate (0, 7, 10, 15) to an ITBMS code */
function taxRateToCode(rate: number): '00' | '01' | '02' | '03' {
    if (rate === 0) return '00';
    if (rate === 10) return '02';
    if (rate === 15) return '03';
    return '01'; // default 7%
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function calculateItem(input: AddItemInput, id?: string): InvoiceItem {
    const {
        codigo = '',
        descripcion,
        cantidad,
        precioUnitario,
        descuento = 0,
        tasaITBMS = '01',
        productId,
        cpbsCode,
        cpbsUnit,
        rucTercero,
        numeroDocumentoTercero,
    } = input;

    const precioUnitarioDescuento = round2(precioUnitario - descuento);
    const subtotal = round2(cantidad * precioUnitarioDescuento);
    const itbmsRate = getITBMSRate(tasaITBMS);
    const itbms = round2(subtotal * itbmsRate);
    const total = round2(subtotal + itbms);

    return {
        id: id ?? generateId(),
        codigo,
        descripcion,
        cantidad,
        precioUnitario,
        precioUnitarioDescuento,
        tasaITBMS,
        productId,
        cpbsCode,
        cpbsUnit,
        rucTercero,
        numeroDocumentoTercero,
        subtotal,
        itbms,
        total,
    };
}

// ============================================
// HOOK
// ============================================

export function useInvoiceItems(initialItems: InvoiceItem[] = []): UseInvoiceItemsReturn {
    const [items, setItemsState] = useState<InvoiceItem[]>(initialItems);

    const totals = useMemo<ItemTotals>(() => {
        return items.reduce(
            (acc, item) => ({
                subtotal: round2(acc.subtotal + item.subtotal),
                totalITBMS: round2(acc.totalITBMS + item.itbms),
                totalDescuentos: round2(
                    acc.totalDescuentos + (item.precioUnitario - item.precioUnitarioDescuento) * item.cantidad
                ),
                totalGeneral: round2(acc.totalGeneral + item.total),
                itemCount: acc.itemCount + 1,
            }),
            { subtotal: 0, totalITBMS: 0, totalDescuentos: 0, totalGeneral: 0, itemCount: 0 }
        );
    }, [items]);

    const addItem = useCallback((input: AddItemInput) => {
        const newItem = calculateItem(input);
        setItemsState(prev => [...prev, newItem]);
    }, []);

    const updateItem = useCallback((id: string, updates: Partial<AddItemInput>) => {
        setItemsState(prev =>
            prev.map(item => {
                if (item.id !== id) return item;

                const merged: AddItemInput = {
                    codigo: updates.codigo ?? item.codigo,
                    descripcion: updates.descripcion ?? item.descripcion,
                    cantidad: updates.cantidad ?? item.cantidad,
                    precioUnitario: updates.precioUnitario ?? item.precioUnitario,
                    descuento: updates.descuento ?? (item.precioUnitario - item.precioUnitarioDescuento),
                    tasaITBMS: updates.tasaITBMS ?? item.tasaITBMS,
                    productId: updates.productId !== undefined ? updates.productId : item.productId,
                    cpbsCode: updates.cpbsCode !== undefined ? updates.cpbsCode : item.cpbsCode,
                    cpbsUnit: updates.cpbsUnit !== undefined ? updates.cpbsUnit : item.cpbsUnit,
                };

                return calculateItem(merged, id);
            })
        );
    }, []);

    const removeItem = useCallback((id: string) => {
        setItemsState(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearItems = useCallback(() => {
        setItemsState([]);
    }, []);

    const setItems = useCallback((newItems: InvoiceItem[]) => {
        setItemsState(newItems);
    }, []);

    /**
     * Auto-populate items from a referenced invoice (NC/ND referenced mode).
     * Maps the external shape to InvoiceItem format with correct ITBMS codes.
     */
    const loadFromReferencedInvoice = useCallback((refItems: ReferencedInvoiceItem[]) => {
        const mapped: InvoiceItem[] = refItems.map((orig, idx) => {
            const tasaITBMS = taxRateToCode(orig.taxRate);
            return calculateItem({
                codigo: orig.code,
                descripcion: orig.description,
                cantidad: orig.quantity,
                precioUnitario: orig.unitPrice,
                descuento: orig.discount,
                tasaITBMS,
            }, `ref-${idx}-${Date.now()}`);
        });
        setItemsState(mapped);
    }, []);

    const getItemsForHKA = useCallback(() => {
        return items.map(item => ({
            descripcion: item.descripcion,
            codigo: item.codigo || undefined,
            cantidad: item.cantidad.toFixed(2),
            precioUnitario: item.precioUnitario.toFixed(2),
            precioUnitarioDescuento: item.precioUnitarioDescuento.toFixed(2),
            precioItem: item.subtotal.toFixed(2),
            valorTotal: item.total.toFixed(2),
            tasaITBMS: item.tasaITBMS,
            valorITBMS: item.itbms.toFixed(2),
            productId: item.productId,
            cpbsCode: item.cpbsCode,
            cpbsUnit: item.cpbsUnit,
            rucTercero: item.rucTercero,
            numeroDocumentoTercero: item.numeroDocumentoTercero,
        }));
    }, [items]);

    return {
        items,
        totals,
        addItem,
        updateItem,
        removeItem,
        clearItems,
        setItems,
        loadFromReferencedInvoice,
        getItemsForHKA,
    };
}
