/**
 * Catálogo de Incoterms DGI Panamá - Tabla 32
 *
 * Términos comerciales internacionales según normativa DGI Panamá
 * para facturación electrónica, especialmente en Facturas de Exportación (tipo 03 HKA).
 *
 * @see https://dgi.mef.gob.pa - Tabla 32 de catálogos
 */

/**
 * Incoterms DGI - Catálogo completo de 11 términos
 *
 * Mapea códigos de incoterms a sus descripciones en español
 * según el estándar DGI para facturación electrónica.
 *
 * @example
 * ```typescript
 * const description = INCOTERMS_DGI.FOB; // "Franco a bordo"
 * ```
 */
export const INCOTERMS_DGI = {
  /** En fábrica (Ex Works) */
  EXW: 'En fábrica',
  /** Franco transportista (Free Carrier) */
  FCA: 'Franco transportista',
  /** Franco al costado del buque (Free Alongside Ship) */
  FAS: 'Franco al costado del buque',
  /** Franco a bordo (Free on Board) */
  FOB: 'Franco a bordo',
  /** Coste y flete (Cost and Freight) */
  CFR: 'Coste y flete',
  /** Coste, seguro y flete (Cost, Insurance and Freight) */
  CIF: 'Coste, seguro y flete',
  /** Transporte pagado hasta (Carriage Paid To) */
  CPT: 'Transporte pagado hasta',
  /** Transporte y seguro pagados hasta (Carriage and Insurance Paid To) */
  CIP: 'Transporte y seguro pagados hasta',
  /** Entregada en lugar (Delivered at Place) */
  DAP: 'Entregada en lugar',
  /** Entregada en lugar descargada (Delivered at Place Unloaded) */
  DPU: 'Entregada en lugar descargada',
  /** Entregada con derechos pagados (Delivered Duty Paid) */
  DDP: 'Entregada con derechos pagados',
} as const;

/**
 * Tipo para códigos de incoterms válidos
 *
 * Garantiza que solo se usen códigos existentes en el catálogo DGI.
 */
export type IncotermCode = keyof typeof INCOTERMS_DGI;

/**
 * Validador de incoterms
 *
 * Comprueba si una cadena es un código de incoterm válido en el catálogo DGI.
 *
 * @param v - Valor a validar
 * @returns true si v es un código de incoterm válido, false en caso contrario
 *
 * @example
 * ```typescript
 * isValidIncoterm('FOB'); // true
 * isValidIncoterm('fob'); // false (case-sensitive)
 * isValidIncoterm('XYZ'); // false
 * ```
 */
export const isValidIncoterm = (v: string): v is IncotermCode => v in INCOTERMS_DGI;
