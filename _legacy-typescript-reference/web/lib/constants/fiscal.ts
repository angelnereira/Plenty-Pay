/**
 * Sistema tributario de Panamá - Tasas ITBMS
 * Constantes fiscales según DGI
 * 
 * @see https://dgi.mef.gob.pa
 */

/**
 * Tasas de ITBMS (Impuesto de Transferencia de Bienes Muebles y Servicios)
 * 
 * Tasas oficiales según la DGI de Panamá.
 * 
 * @see https://dgi.mef.gob.pa
 * 
 * @example
 * ```typescript
 * const taxAmount = subtotal * TAX_RATES.GENERAL; // 7%
 * ```
 */
export const TAX_RATES = {
    /** 0% - Exento */
    EXEMPT: 0.00,
    /** 7% - Tasa general */
    GENERAL: 0.07,
    /** 10% - Bebidas alcohólicas, hospedaje */
    ALCOHOL_HOTEL: 0.10,
    /** 15% - Tabaco */
    TOBACCO: 0.15,
} as const;

/**
 * Códigos de tasa ITBMS para documentos electrónicos
 * 
 * Mapea códigos de factura electrónica a porcentajes de ITBMS.
 * Estos códigos se usan en el XML de facturación electrónica.
 * 
 * @example
 * ```typescript
 * const rate = TAX_CODES['01']; // 0.07 (7%)
 * ```
 */
export const TAX_CODES = {
    '00': TAX_RATES.EXEMPT,
    '01': TAX_RATES.GENERAL,
    '02': TAX_RATES.ALCOHOL_HOTEL,
    '03': TAX_RATES.TOBACCO,
} as const;

/**
 * Tasa ITBMS por defecto (7%)
 * 
 * Tasa general aplicable a la mayoría de productos y servicios.
 */
export const DEFAULT_TAX_RATE = TAX_RATES.GENERAL;

/**
 * Código de tasa ITBMS por defecto
 * 
 * Código '01' corresponde a la tasa general del 7%.
 */
export const DEFAULT_TAX_CODE = '01';

/**
 * Tipos de documento fiscal
 */
export const DOCUMENT_TYPES = {
    /** Factura de operación interna */
    INVOICE: '01',
    /** Factura de importación */
    IMPORT: '02',
    /** Factura de exportación */
    EXPORT: '03',
    /** Nota de Crédito (referencia FE) */
    CREDIT_NOTE: '04',
    /** Nota de Débito (referencia FE) */
    DEBIT_NOTE: '05',
    /** Nota de Crédito genérica */
    CREDIT_NOTE_GENERIC: '06',
    /** Nota de Débito genérica */
    DEBIT_NOTE_GENERIC: '07',
} as const;

/**
 * Tipos de cliente fiscal
 */
export const CLIENT_TYPES = {
    /** Contribuyente */
    TAXPAYER: '01',
    /** Consumidor Final */
    CONSUMER: '02',
    /** Gobierno */
    GOVERNMENT: '03',
    /** Extranjero */
    FOREIGN: '04',
} as const;
