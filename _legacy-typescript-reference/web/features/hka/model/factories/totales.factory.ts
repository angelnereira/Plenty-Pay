/**
 * Totales Factory
 * 
 * Factory Pattern for calculating and creating HKA invoice totals.
 * Handles ITBMS calculations according to DGI rules.
 * 
 * @module lib/features/hka/factories/totales.factory
 */

import {
    Ok,
    Err,
    Result,
    ValidationError,
} from '@shared/lib/result';
import { roundDGI } from '../services/utils';

// ============================================
// TYPES
// ============================================

/**
 * Input item for totals calculation
 */
export interface ItemInput {
    cantidad: number;
    precioUnitario: number;
    precioUnitarioDescuento?: number; // Precio con descuento aplicado
    tasaITBMS: string; // '00', '01', '02', '03'
}

/**
 * Calculated item totals
 */
export interface ItemTotales {
    precioItem: number; // cantidad * precioUnitarioDescuento
    valorITBMS: number; // ITBMS calculated
    valorTotal: number; // precioItem + valorITBMS
}

/**
 * Document totals structure for HKA
 */
export interface DocumentoTotales {
    totalPrecioNeto: number;
    totalITBMS: number;
    totalMontoGravado: number;
    totalDescuento: number;
    totalAcarreoCobrado: number;
    valorSeguroCobrado: number;
    totalFactura: number;
    totalValorRecibido: number;
    vuelto: number;
    tiempoPago: string;
    nroItems: number;
    totalTodosItems: number;
    // Desglose por tasa ITBMS
    listaFormaPago: FormaPago;
    listaDescGlobalAR?: DescuentoGlobal;
}

/**
 * Payment info
 */
export interface FormaPago {
    formaPagoFact: string;
    descFormaPago: string;
    valorCuotaPagada: number;
}

/**
 * Global discount
 */
export interface DescuentoGlobal {
    descDescuento: string;
    montoDescuento: number;
}

// ============================================
// ITBMS RATES
// ============================================

/**
 * ITBMS tax rates according to DGI
 */
export const ITBMS_RATES: Record<string, number> = {
    '00': 0,      // Exento
    '01': 0.07,   // 7%
    '02': 0.10,   // 10% (tabaco, licor)
    '03': 0.15,   // 15% (combustible)
};

/**
 * ITBMS descriptions
 */
export const ITBMS_DESCRIPTIONS: Record<string, string> = {
    '00': 'Exento de ITBMS',
    '01': 'ITBMS 7%',
    '02': 'ITBMS 10%',
    '03': 'ITBMS 15%',
};

// ============================================
// FACTORY CLASS
// ============================================

export class TotalesFactory {
    /**
     * Get ITBMS rate from code
     */
    static getITBMSRate(code: string): number {
        return ITBMS_RATES[code] ?? 0.07; // Default to 7%
    }

    /**
     * Calculate item totals
     */
    static calculateItemTotals(item: ItemInput): Result<ItemTotales, ValidationError> {
        // Validate
        if (item.cantidad <= 0) {
            return Err(new ValidationError('cantidad', 'La cantidad debe ser mayor a 0'));
        }
        if (item.precioUnitario < 0) {
            return Err(new ValidationError('precioUnitario', 'El precio unitario no puede ser negativo'));
        }

        const precioEfectivo = item.precioUnitarioDescuento ?? item.precioUnitario;
        const rate = this.getITBMSRate(item.tasaITBMS);

        // Calculate: precioItem = cantidad * precio (without ITBMS)
        const precioItem = roundDGI(item.cantidad * precioEfectivo);

        // Calculate ITBMS on the total price
        const valorITBMS = roundDGI(precioItem * rate);

        // Total = precioItem + ITBMS
        const valorTotal = roundDGI(precioItem + valorITBMS);

        return Ok({
            precioItem,
            valorITBMS,
            valorTotal,
        });
    }

    /**
     * Calculate document totals from items
     */
    static calculateDocumentTotals(
        items: ItemInput[],
        options?: {
            descuentoGlobal?: number;
            acarreo?: number;
            seguro?: number;
            formaPago?: string;
            tiempoPago?: string;
        }
    ): Result<DocumentoTotales, ValidationError> {
        if (items.length === 0) {
            return Err(new ValidationError('items', 'Debe haber al menos un item'));
        }

        let totalPrecioNeto = 0;
        let totalITBMS = 0;
        let totalDescuento = 0;

        // Calculate item by item
        for (const item of items) {
            const itemResult = this.calculateItemTotals(item);
            if (!itemResult.ok) {
                return itemResult;
            }

            totalPrecioNeto += itemResult.value.precioItem;
            totalITBMS += itemResult.value.valorITBMS;

            // Calculate discount if applicable
            if (item.precioUnitarioDescuento !== undefined && item.precioUnitarioDescuento < item.precioUnitario) {
                const descuentoPorItem = (item.precioUnitario - item.precioUnitarioDescuento) * item.cantidad;
                totalDescuento += descuentoPorItem;
            }
        }

        // Add global discount if any
        const globalDiscount = options?.descuentoGlobal ?? 0;
        totalDescuento += globalDiscount;

        // Additional charges
        const acarreo = options?.acarreo ?? 0;
        const seguro = options?.seguro ?? 0;

        // Final totals
        totalPrecioNeto = roundDGI(totalPrecioNeto);
        totalITBMS = roundDGI(totalITBMS);
        totalDescuento = roundDGI(totalDescuento);

        const totalMontoGravado = roundDGI(totalPrecioNeto);
        const totalFactura = roundDGI(totalPrecioNeto + totalITBMS + acarreo + seguro);

        return Ok({
            totalPrecioNeto,
            totalITBMS,
            totalMontoGravado,
            totalDescuento,
            totalAcarreoCobrado: acarreo,
            valorSeguroCobrado: seguro,
            totalFactura,
            totalValorRecibido: totalFactura,
            vuelto: 0,
            tiempoPago: options?.tiempoPago ?? '1', // 1 = Contado
            nroItems: items.length,
            totalTodosItems: totalFactura,
            listaFormaPago: {
                formaPagoFact: options?.formaPago ?? '02', // 02 = Efectivo
                descFormaPago: this.getPaymentDescription(options?.formaPago ?? '02'),
                valorCuotaPagada: totalFactura,
            },
            ...(globalDiscount > 0 && {
                listaDescGlobalAR: {
                    descDescuento: 'Descuento aplicado',
                    montoDescuento: globalDiscount,
                },
            }),
        });
    }

    /**
     * Create empty totals (for draft invoices)
     */
    static createEmpty(): DocumentoTotales {
        return {
            totalPrecioNeto: 0,
            totalITBMS: 0,
            totalMontoGravado: 0,
            totalDescuento: 0,
            totalAcarreoCobrado: 0,
            valorSeguroCobrado: 0,
            totalFactura: 0,
            totalValorRecibido: 0,
            vuelto: 0,
            tiempoPago: '1',
            nroItems: 0,
            totalTodosItems: 0,
            listaFormaPago: {
                formaPagoFact: '02',
                descFormaPago: 'Efectivo',
                valorCuotaPagada: 0,
            },
        };
    }

    /**
     * Get payment method description
     */
    static getPaymentDescription(code: string): string {
        const descriptions: Record<string, string> = {
            '01': 'Tarjeta de Crédito',
            '02': 'Efectivo',
            '03': 'ACH',
            '04': 'Tarjeta de Débito',
            '05': 'Cheque',
            '06': 'Transferencia',
            '08': 'Otro',
            '99': 'Varios',
        };
        return descriptions[code] ?? 'Otro';
    }

    /**
     * Format number for HKA (always 2 decimals) using the official DGI rounding rule.
     */
    static formatForHKA(value: number): string {
        return roundDGI(value).toFixed(2);
    }
}
