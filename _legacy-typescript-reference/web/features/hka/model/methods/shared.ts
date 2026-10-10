/**
 * HKA Methods - Shared Utilities
 * 
 * Consolidates common logic used across all HKA method files
 * (status, downloads, cancellation, email)
 */

import type {
    DatosDocumento,
    HKAConfig,
    TipoDocumento,
    TipoEmision,
} from '../types/types';
import { padLeft, extractInvoiceNumber } from '../services/utils';

/**
 * Input base para cualquier operación que requiera DatosDocumento
 */
export interface DatosDocumentoInput {
    /** Número de documento fiscal */
    numeroDocumentoFiscal: string;
    /** Código de sucursal (default: de configuración) */
    codigoSucursalEmisor?: string;
    /** Punto de facturación (default: de configuración) */
    puntoFacturacionFiscal?: string;
    /** Tipo de documento (default: "01" - Factura) */
    tipoDocumento?: TipoDocumento;
    /** Tipo de emisión (default: "01" - Normal) */
    tipoEmision?: TipoEmision;
}

/**
 * Construye el objeto DatosDocumento con valores por defecto de la configuración.
 * 
 * IMPORTANTE: Si tienes el tipoDocumento del invoice en la BD, pásalo
 * en input.tipoDocumento para evitar el default hardcodeado '01'.
 * 
 * @param input - Datos del documento (al menos numeroDocumentoFiscal)
 * @param config - Configuración HKA con valores por defecto
 * @returns DatosDocumento formateado para enviar a HKA
 */
export function buildDatosDocumento(
    input: DatosDocumentoInput,
    config: HKAConfig
): DatosDocumento {
    const numeroRaw = extractInvoiceNumber(input.numeroDocumentoFiscal);
    const numeroFormateado = padLeft(numeroRaw, 10);

    return {
        codigoSucursalEmisor: input.codigoSucursalEmisor || config.branchCode,
        numeroDocumentoFiscal: numeroFormateado,
        puntoFacturacionFiscal: input.puntoFacturacionFiscal || config.puntoFacturacionFiscal,
        tipoDocumento: input.tipoDocumento || '01',
        tipoEmision: input.tipoEmision || config.tipoEmision,
    };
}
