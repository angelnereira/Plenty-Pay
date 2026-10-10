/**
 * Validadores de Catálogos HKA
 * 
 * Funciones centralizadas para validar todos los catálogos
 */

import {
    INCOTERMS,
    type IncotermCode
} from '../types/catalogs/constants/incoterms';

import {
    CURRENCIES,
    type CurrencyCode
} from '../types/catalogs/constants/currencies';

import {
    UNITS,
    type UnitCode
} from '../types/catalogs/constants/units';

const isValidIncoterm = (code: string) => Object.keys(INCOTERMS).includes(code);
const isValidCurrency = (code: string) => Object.keys(CURRENCIES).includes(code);
const isValidUnit = (code: string) => Object.keys(UNITS).includes(code);

// GTIN validation helper (gtin-formats module not available)
type GTINFormat = 'GTIN-8' | 'GTIN-12' | 'GTIN-13' | 'GTIN-14';
function validateGTIN(gtin: string): { valid: boolean; error?: string; format?: GTINFormat } {
    const len = gtin.replace(/\D/g, '').length;
    if (len === 8) return { valid: true, format: 'GTIN-8' };
    if (len === 12) return { valid: true, format: 'GTIN-12' };
    if (len === 13) return { valid: true, format: 'GTIN-13' };
    if (len === 14) return { valid: true, format: 'GTIN-14' };
    return { valid: false, error: `GTIN inválido: longitud ${len} no reconocida` };
}

/**
 * Resultado de validación
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
    code?: string;
}

/**
 * Validar INCOTERM
 */
export function validateIncotermCode(code: string): ValidationResult {
    if (!code) {
        return { valid: false, error: 'Código INCOTERM requerido' };
    }

    const valid = isValidIncoterm(code);
    return valid
        ? { valid: true, code }
        : { valid: false, error: `INCOTERM inválido: ${code}` };
}

/**
 * Validar moneda
 */
export function validateCurrencyCode(code: string): ValidationResult {
    if (!code) {
        return { valid: false, error: 'Código de moneda requerido' };
    }

    const valid = isValidCurrency(code);
    return valid
        ? { valid: true, code }
        : { valid: false, error: `Moneda inválida: ${code}. Use códigos ISO 4217` };
}

/**
 * Validar unidad de medida
 */
export function validateUnitCode(code: string): ValidationResult {
    if (!code) {
        return { valid: false, error: 'Código de unidad requerido' };
    }

    const valid = isValidUnit(code);
    return valid
        ? { valid: true, code }
        : { valid: false, error: `Unidad inválida: ${code}` };
}

/**
 * Validar código GTIN
 */
export function validateGTINCode(gtin: string | null | undefined): ValidationResult {
    if (!gtin) {
        // GTIN es opcional
        return { valid: true };
    }

    const result = validateGTIN(gtin);
    return result.valid
        ? { valid: true, code: gtin }
        : { valid: false, error: result.error };
}

/**
 * Validar item de factura completo
 */
export interface InvoiceItemValidation {
    currency?: ValidationResult;
    unit: ValidationResult;
    gtin?: ValidationResult;
    incoterm?: ValidationResult;
}

export function validateInvoiceItem(item: {
    unit: string;
    currency?: string;
    gtin?: string | null;
    incoterm?: string | null;
}): InvoiceItemValidation {
    const result: InvoiceItemValidation = {
        unit: validateUnitCode(item.unit),
    };

    if (item.currency) {
        result.currency = validateCurrencyCode(item.currency);
    }

    if (item.gtin) {
        result.gtin = validateGTINCode(item.gtin);
    }

    if (item.incoterm) {
        result.incoterm = validateIncotermCode(item.incoterm);
    }

    return result;
}

/**
 * Verificar si todas las validaciones pasaron
 */
export function allValidationsPassed(validation: InvoiceItemValidation): boolean {
    return Object.values(validation).every(v => v?.valid !== false);
}

/**
 * Obtener todos los errores de validación
 */
export function getValidationErrors(validation: InvoiceItemValidation): string[] {
    const errors: string[] = [];

    Object.entries(validation).forEach(([field, result]) => {
        if (result && !result.valid && result.error) {
            errors.push(`${field}: ${result.error}`);
        }
    });

    return errors;
}
