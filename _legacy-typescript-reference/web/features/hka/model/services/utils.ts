/**
 * HKA Web Service - Utilidades de Formato
 * 
 * Funciones auxiliares para cumplir estrictamente los formatos requeridos por HKA
 * según HKA_Documentacion_Completa.md
 */

import { formatPanama } from '@/lib/date-utils';

/**
 * Rellena con ceros a la izquierda hasta alcanzar la longitud especificada
 * Usado para: numeroDocumentoFiscal (10 dígitos), puntoFacturacionFiscal (3 dígitos), etc.
 * 
 * @param value - Valor a formatear
 * @param length - Longitud total deseada
 * @returns String con padding de ceros
 * @example padLeft("176", 10) => "0000000176"
 */
export function padLeft(value: string | number, length: number): string {
  const strValue = String(value);
  if (strValue.length >= length) {
    return strValue.slice(-length);
  }
  return strValue.padStart(length, '0');
}

/**
 * Formatea un número decimal con la cantidad exacta de decimales y punto como separador
 * HKA requiere punto como separador decimal, nunca coma
 * 
 * @param value - Valor numérico a formatear
 * @param decimals - Cantidad de decimales (por defecto 2)
 * @returns String formateado con decimales
 * @example formatDecimal(10, 2) => "10.00"
 * @example formatDecimal(15.5, 6) => "15.500000"
 */
export function formatDecimal(value: number | string, decimals: number = 2): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) {
    return (0).toFixed(decimals);
  }
  return numValue.toFixed(decimals);
}

/**
 * Formatea una fecha en formato ISO 8601 con zona horaria de Panamá
 * Formato requerido: AAAA-MM-DDThh:mm:ssTZH (ejemplo: 2022-07-15T07:49:27-05:00)
 * 
 * @param date - Fecha a formatear (Date object o string)
 * @returns String en formato ISO 8601 con zona horaria -05:00 (Panamá)
 * @example formatDateISO8601(new Date()) => "2024-12-05T14:30:00-05:00"
 */
export function formatDateISO8601(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  // HKA requires -05:00 offset. formatPanama uses 'America/Panama' which is -05:00.
  // We use format 'yyyy-MM-dd\'T\'HH:mm:ssXXX' or manually append if needed.
  // date-fns-tz format 'XXX' gives offset like -05:00.
  return formatPanama(d, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/**
 * Formatea fecha simple AAAA-MM-DD
 * Usado para: fechaFabricacion, fechaCaducidad
 * 
 * @param date - Fecha a formatear
 * @returns String en formato AAAA-MM-DD
 */
export function formatDateSimple(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Elimina campos undefined, null o strings vacíos de un objeto recursivamente
/**
 * Formatea un número de teléfono al formato requerido por DGI/HKA: 999-9999 o 9999-9999
 *
 * DGI requiere guión separador. Campo dTfnRec (B408): longitud 7-12 caracteres.
 * Formatos válidos: 999-9999 (7 dígitos) o 9999-9999 (8 dígitos).
 *
 * @param phone - Teléfono en cualquier formato
 * @returns Teléfono formateado con guión, o undefined si no es válido
 */
export function formatPhoneForDGI(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined;

  // Extraer solo dígitos
  const digits = phone.replace(/\D/g, '');

  // Si ya tiene guión y formato correcto, devolver tal cual
  if (/^\d{3,4}-\d{4}$/.test(phone.trim())) {
    return phone.trim();
  }

  // 7 dígitos → XXX-XXXX
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  // 8 dígitos → XXXX-XXXX
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // Si tiene más dígitos (ej: código de país), tomar los últimos 7-8
  if (digits.length > 8) {
    const last8 = digits.slice(-8);
    return `${last8.slice(0, 4)}-${last8.slice(4)}`;
  }

  // Menos de 7 dígitos: no es un teléfono válido para DGI, omitir
  return undefined;
}

/**
 * REGLA CRÍTICA HKA: Los campos opcionales que no apliquen NO deben incluirse en el XML
 *
 * @param obj - Objeto a limpiar
 * @returns Objeto sin campos vacíos/undefined/null
 */
export function cleanXMLObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Ignorar undefined, null y strings vacíos
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Recursivamente limpiar objetos anidados
    if (typeof value === 'object' && !Array.isArray(value)) {
      const cleaned = cleanXMLObject(value as Record<string, unknown>);
      // Solo incluir si el objeto limpio tiene propiedades
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    }
    // Limpiar arrays
    else if (Array.isArray(value)) {
      const cleanedArray = value
        .filter(item => item !== undefined && item !== null)
        .map(item => {
          if (typeof item === 'object') {
            return cleanXMLObject(item as Record<string, unknown>);
          }
          return item;
        });
      if (cleanedArray.length > 0) {
        result[key] = cleanedArray;
      }
    }
    // Valores primitivos válidos
    else {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}

/**
 * Valida un CUFE según su origen:
 *
 *   - CUFE certificado por HKA (online): 66 caracteres
 *     Retornado por el método Enviar() y almacenado en el campo cufe de la DB.
 *
 *   - CUFE local DGI (contingencia/offline): 64 caracteres
 *     Generado por cufe.service.ts cuando no hay conexión con HKA.
 *     Cadena base (63) + dígito verificador Luhn (1) = 64.
 *
 * @param cufe - Código CUFE a validar
 * @param origen - 'hka' para 66 chars (default) | 'local' para 64 chars
 * @returns true si tiene la longitud correcta según su origen
 */
export function validateCUFE(cufe: string, origen: 'hka' | 'local' = 'hka'): boolean {
  if (typeof cufe !== 'string') return false;
  return origen === 'local' ? cufe.length === 64 : cufe.length === 66;
}

/**
 * Detecta automáticamente si un CUFE es HKA-certificado (66) o local DGI (64)
 */
export function detectCUFEOrigen(cufe: string): 'hka' | 'local' | 'invalid' {
  if (typeof cufe !== 'string') return 'invalid';
  if (cufe.length === 66) return 'hka';
  if (cufe.length === 64) return 'local';
  return 'invalid';
}

/**
 * Valida que el punto de facturación no sea "000"
 * HKA no admite el valor "000" para puntoFacturacionFiscal
 * 
 * @param punto - Punto de facturación a validar
 * @returns true si es válido (no es "000")
 */
export function validatePuntoFacturacion(punto: string): boolean {
  const formatted = padLeft(punto, 3);
  return formatted !== '000';
}

/**
 * Calcula el precio del ítem según fórmula HKA:
 * precioItem = cantidad × (precioUnitario - precioUnitarioDescuento)
 * 
 * @param cantidad - Cantidad de productos
 * @param precioUnitario - Precio unitario
 * @param descuento - Descuento unitario (en Balboas, no porcentaje)
 * @returns Precio del ítem calculado
 */
export function calcularPrecioItem(
  cantidad: number,
  precioUnitario: number,
  descuento: number = 0
): number {
  return cantidad * (precioUnitario - descuento);
}

/**
 * Calcula el valor del ITBMS según la tasa
 * 
 * @param precioItem - Precio del ítem (base imponible)
 * @param tasaITBMS - Código de tasa: 00=0%, 01=7%, 02=10%, 03=15%
 * @returns Valor del ITBMS calculado
 */
export function calcularITBMS(precioItem: number, tasaITBMS: string): number {
  const tasas: Record<string, number> = {
    '00': 0,
    '01': 7,
    '02': 10,
    '03': 15,
  };
  const porcentaje = tasas[tasaITBMS] || 0;
  return precioItem * (porcentaje / 100);
}

/**
 * Calcula el valor total del ítem según fórmula HKA:
 * valorTotal = precioItem + precioAcarreo + precioSeguro + valorITBMS + valorISC
 * 
 * @param precioItem - Precio del ítem
 * @param valorITBMS - Valor del ITBMS
 * @param valorISC - Valor del ISC (opcional)
 * @param precioAcarreo - Precio de acarreo (opcional)
 * @param precioSeguro - Precio de seguro (opcional)
 * @returns Valor total del ítem
 */
export function calcularValorTotal(
  precioItem: number,
  valorITBMS: number,
  valorISC: number = 0,
  precioAcarreo: number = 0,
  precioSeguro: number = 0
): number {
  return precioItem + precioAcarreo + precioSeguro + valorITBMS + valorISC;
}

/**
 * Mapea el código de forma de pago de tu sistema al código HKA
 * 
 * @param paymentMethod - Método de pago de tu sistema
 * @returns Código HKA (01-99)
 */
export function mapPaymentMethodToHKA(paymentMethod: string): string {
  const mapping: Record<string, string> = {
    'CASH': '02',
    'EFECTIVO': '02',
    'CREDIT_CARD': '03',
    'TARJETA_CREDITO': '03',
    'DEBIT_CARD': '04',
    'TARJETA_DEBITO': '04',
    'TRANSFER': '08',
    'TRANSFERENCIA': '08',
    'CHECK': '09',
    'CHEQUE': '09',
    'CREDIT': '01',
    'CREDITO': '01',
  };
  return mapping[paymentMethod.toUpperCase()] || '02'; // Default: Efectivo
}

/**
 * Mapea el tipo de documento de Prisma a código HKA
 *
 * Para NC/ND, el subtipo determina si es referenciada (04/05) o genérica (06/07):
 * - NOTA_CREDITO + REFERENCED → 04 (NC referente a FE)
 * - NOTA_CREDITO + GENERIC → 06 (NC genérica)
 * - NOTA_DEBITO + REFERENCED → 05 (ND referente a FE)
 * - NOTA_DEBITO + GENERIC → 07 (ND genérica)
 *
 * @param documentType - Tipo de documento de Prisma (FACTURA, NOTA_CREDITO, etc.)
 * @param noteSubtype - Subtipo de nota: 'REFERENCED' o 'GENERIC' (solo para NC/ND)
 * @returns Código HKA (01-10)
 */
export function mapDocumentTypeToHKA(documentType: string, noteSubtype?: string | null): string {
  if (documentType === 'NOTA_CREDITO') {
    return noteSubtype === 'GENERIC' ? '06' : '04';
  }
  if (documentType === 'NOTA_DEBITO') {
    return noteSubtype === 'GENERIC' ? '07' : '05';
  }
  const mapping: Record<string, string> = {
    'FACTURA': '01',
    'FACTURA_IMPORTACION': '02',
    'FACTURA_EXPORTACION': '03',
    'FACTURA_ZONA_FRANCA': '08',
    'REEMBOLSO': '09',
    'FACTURA_EXTRANJERA': '10',
  };
  return mapping[documentType] || '01';
}

/**
 * Mapea el código de tipo de documento HKA a Prisma DocumentType
 *
 * @param hkaCode - Código HKA (01-10)
 * @returns DocumentType de Prisma
 */
export function mapHKAToDocumentType(hkaCode: string | undefined): string {
  const mapping: Record<string, string> = {
    '01': 'FACTURA',
    '02': 'FACTURA_IMPORTACION',
    '03': 'FACTURA_EXPORTACION',
    '04': 'NOTA_CREDITO',
    '05': 'NOTA_DEBITO',
    '06': 'NOTA_CREDITO', // Genérica
    '07': 'NOTA_DEBITO', // Genérica
    '08': 'FACTURA_ZONA_FRANCA',
    '09': 'REEMBOLSO',
    '10': 'FACTURA_EXTRANJERA',
  };
  return mapping[hkaCode || ''] || 'FACTURA';
}

/**
 * Mapea el tipo de receptor de Prisma a tipoClienteFE de HKA
 * 
 * @param receiverType - Tipo de receptor de Prisma
 * @returns Código HKA (01-04)
 */
export function mapReceiverTypeToHKA(receiverType: string): string {
  const mapping: Record<string, string> = {
    'CONTRIBUTOR': '01',
    'FINAL_CONSUMER': '02',
    'FOREIGN': '04',
    'GOVERNMENT': '03',
  };
  return mapping[receiverType] || '02'; // Default: Consumidor final
}

/**
 * Sanitiza un string para uso en XML (escapa caracteres especiales)
 * 
 * @param str - String a sanitizar
 * @returns String sanitizado para XML
 */
export function sanitizeForXML(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Trunca un string a la longitud máxima permitida
 * 
 * @param str - String a truncar
 * @param maxLength - Longitud máxima
 * @returns String truncado
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str || '';
  return str.substring(0, maxLength);
}

/**
 * Genera código de ubicación en formato HKA: provincia-distrito-corregimiento
 * 
 * @param provincia - Código de provincia
 * @param distrito - Código de distrito
 * @param corregimiento - Código de corregimiento
 * @returns String en formato "X-X-X"
 */
export function formatLocationCode(
  provincia: string | number,
  distrito: string | number,
  corregimiento: string | number
): string {
  return `${provincia}-${distrito}-${corregimiento}`;
}

/**
 * Parsea un código de ubicación HKA
 * 
 * @param locationCode - Código en formato "X-X-X"
 * @returns Objeto con provincia, distrito y corregimiento
 */
export function parseLocationCode(locationCode: string): {
  provincia: string;
  distrito: string;
  corregimiento: string;
} {
  const parts = locationCode.split('-');
  return {
    provincia: parts[0] || '1',
    distrito: parts[1] || '1',
    corregimiento: parts[2] || '1',
  };
}

/**
 * Extrae el número de un invoiceNumber formateado
 * Por ejemplo: "FE-2024-000001" -> "1"
 * 
 * @param invoiceNumber - Número de factura formateado
 * @returns Número extraído como string
 */
export function extractInvoiceNumber(invoiceNumber: string | null): string {
  if (!invoiceNumber) return '1';

  // Intentar extraer solo dígitos al final
  const match = invoiceNumber.match(/(\d+)$/);
  if (match) {
    return match[1];
  }

  // Si no hay patrón, devolver solo dígitos
  const digits = invoiceNumber.replace(/\D/g, '');
  return digits || '1';
}

/**
 * Convierte un código de tasa ITBMS a porcentaje numérico
 * 
 * @param taxCode - Código de tasa (00, 01, 02, 03)
 * @returns Porcentaje como número (0, 7, 10, 15)
 */
export function taxCodeToPercentage(taxCode: string): number {
  const rates: Record<string, number> = {
    '00': 0,
    '01': 7,
    '02': 10,
    '03': 15,
  };
  return rates[taxCode] ?? 7; // Default 7%
}

/**
 * Convierte un porcentaje de impuesto al código ITBMS
 * 
 * @param percentage - Porcentaje (0, 7, 10, 15)
 * @returns Código ITBMS (00, 01, 02, 03)
 */
export function percentageToTaxCode(percentage: number): string {
  if (percentage === 0) return '00';
  if (percentage === 7) return '01';
  if (percentage === 10) return '02';
  if (percentage === 15) return '03';
  // Default: 7% (el más común)
  return '01';
}

/**
 * @deprecated Usar `roundDGI` directamente. Se mantiene como alias para compatibilidad.
 */
export function roundToTwo(value: number): number {
  return roundDGI(value);
}

/**
 * Redondeo monetario según la regla estricta DGI Panamá (evita error 2507).
 *
 * Regla DGI:
 *   - Si el tercer decimal < 5 → se trunca (mantiene segundo decimal intacto).
 *   - Si el tercer decimal ≥ 5 → se incrementa el segundo decimal en 1.
 *
 * Esto es "round half up" estándar. Se usa `Number.EPSILON` para corregir
 * imprecisiones de punto flotante (ej: 1.005 → 1.01 en vez de 1.00).
 *
 * Aplicar SIEMPRE antes de serializar montos a XML:
 *   totalFactura, totalITBMS, totalISC, precioItem, valorTotal, etc.
 *
 * @example roundDGI(1.005)  → 1.01   (tercer decimal = 5 → sube)
 * @example roundDGI(1.004)  → 1.00   (tercer decimal = 4 → baja)
 * @example roundDGI(2.5550) → 2.56   (tercer decimal ≥ 5 → sube)
 */
export function roundDGI(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Formatea un monto monetario al string requerido por HKA/DGI.
 * Aplica redondeo DGI y usa punto como separador decimal (no coma).
 *
 * @param value - Valor numérico a formatear
 * @param decimals - Decimales (default 2; usar 6 para precios unitarios)
 */
export function formatMontoDGI(value: number, decimals: 2 | 6 = 2): string {
  const rounded = roundDGI(value);
  return rounded.toFixed(decimals);
}

/**
 * Valida un correo electrónico
 * 
 * @param email - Correo a validar
 * @returns true si es válido
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida un RUC panameño (formato básico)
 * 
 * @param ruc - RUC a validar
 * @returns true si tiene formato válido
 */
export function isValidRUC(ruc: string): boolean {
  // RUC puede ser número con guiones (ej: 155596713-2-2015)
  // o número simple
  if (!ruc) return false;
  const cleaned = ruc.replace(/-/g, '');
  return cleaned.length >= 5 && cleaned.length <= 20;
}

