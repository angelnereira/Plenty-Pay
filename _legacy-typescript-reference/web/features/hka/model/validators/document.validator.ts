/**
 * Document Validator Interface and Strategies
 * 
 * Strategy Pattern for validating different document types in HKA.
 * Each document type (Factura, Nota Crédito, Nota Débito, Exportación)
 * has its own validation rules.
 * 
 * @module lib/features/hka/validators/document.validator
 */

import {
    Ok,
    Err,
    Result,
    ValidationError,
} from '@shared/lib/result';
import type {
    DocumentoElectronico,
    ItemFactura,
    TipoDocumento as HKATipoDocumento,
} from '../types/types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE FECHA
// ─────────────────────────────────────────────────────────────────────────────

/** Cuenta días de diferencia ignorando la hora */
function diffCalendarDays(a: Date, b: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((bUtc - aUtc) / msPerDay);
}

/**
 * Avanza N días hábiles (lunes-viernes) hacia el futuro desde `desde`.
 * Se usa para calcular la ventana de 2 días hábiles permitida (DGI 1520).
 */
function addBusinessDays(desde: Date, dias: number): Date {
    const result = new Date(desde);
    let added = 0;
    while (added < dias) {
        result.setDate(result.getDate() + 1);
        const dow = result.getDay(); // 0=Dom, 6=Sáb
        if (dow !== 0 && dow !== 6) added++;
    }
    return result;
}

// ============================================
// TYPES
// ============================================

/**
 * Validation issue with field and message
 */
export interface ValidationIssue {
    field: string;
    message: string;
    code?: string;
}

/**
 * Validation result with all issues
 */
export interface DocumentValidationResult {
    isValid: boolean;
    issues: ValidationIssue[];
}

/**
 * Document types for validation.
 * Maps to internal validator keys, NOT DGI tipoDocumento codes.
 * 01=Factura, 02=NC, 03=ND, 04=Exportación, 05=Importación, 06=ZonaFranca, 07=Reembolso, 08=Extranjera
 */
export type TipoDocumento = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08';

export const DOCUMENT_TYPE_NAMES: Record<TipoDocumento, string> = {
    '01': 'Factura Electrónica',
    '02': 'Nota de Crédito',
    '03': 'Nota de Débito',
    '04': 'Factura de Exportación',
    '05': 'Factura de Importación',
    '06': 'Factura de Zona Franca',
    '07': 'Reembolso',
    '08': 'Factura Extranjera',
};

// ============================================
// VALIDATOR INTERFACE
// ============================================

/**
 * Document Validator Interface
 * All document type validators must implement this interface
 */
export interface IDocumentValidator {
    /**
     * Validate a document
     * @param documento - The electronic document to validate
     * @returns Validation result with issues if any
     */
    validate(documento: DocumentoElectronico): DocumentValidationResult;

    /**
     * Get list of required fields for this document type
     */
    getRequiredFields(): string[];

    /**
     * Get document type this validator handles
     */
    getDocumentType(): TipoDocumento;
}

// ============================================
// BASE VALIDATOR (Common validations)
// ============================================

abstract class BaseDocumentValidator implements IDocumentValidator {
    abstract getDocumentType(): TipoDocumento;
    abstract getRequiredFields(): string[];

    /**
     * Common validations for all document types
     */
    protected validateCommon(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const cliente = documento.datosTransaccion?.cliente;

        // Cliente validation
        if (!cliente) {
            issues.push({ field: 'datosTransaccion.cliente', message: 'Cliente es requerido' });
        } else {
            if (!cliente.tipoClienteFE) {
                issues.push({ field: 'datosTransaccion.cliente.tipoClienteFE', message: 'Tipo de cliente es requerido' });
            }
            // Only check razonSocial for contribuyentes
            if (cliente.tipoClienteFE === '01' || cliente.tipoClienteFE === '03') {
                const clienteContrib = cliente as { razonSocial?: string };
                if (!clienteContrib.razonSocial) {
                    issues.push({ field: 'datosTransaccion.cliente.razonSocial', message: 'Razón social es requerida' });
                }
            }
        }

        // Items validation
        const items = documento.listaItems;
        if (!items || items.length === 0) {
            issues.push({ field: 'listaItems', message: 'Debe haber al menos un item' });
        } else {
            items.forEach((item: ItemFactura, index: number) => {
                if (!item.descripcion) {
                    issues.push({
                        field: `listaItems[${index}].descripcion`,
                        message: `Item ${index + 1}: Descripción es requerida`
                    });
                }
                if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
                    issues.push({
                        field: `listaItems[${index}].cantidad`,
                        message: `Item ${index + 1}: Cantidad debe ser mayor a 0`
                    });
                }
                if (item.precioUnitario === undefined) {
                    issues.push({
                        field: `listaItems[${index}].precioUnitario`,
                        message: `Item ${index + 1}: Precio unitario es requerido`
                    });
                }
            });
        }

        // Totals validation
        if (!documento.totalesSubTotales) {
            issues.push({ field: 'totalesSubTotales', message: 'Totales son requeridos' });
        } else {
            if (documento.totalesSubTotales.totalFactura === undefined) {
                issues.push({ field: 'totalesSubTotales.totalFactura', message: 'Total factura es requerido' });
            }
        }

        // Payment validation
        if (!documento.totalesSubTotales?.listaFormaPago || documento.totalesSubTotales.listaFormaPago.length === 0) {
            issues.push({ field: 'totalesSubTotales.listaFormaPago', message: 'Forma de pago es requerida' });
        }

        // Ventana de fecha de emisión (DGI 1519 / 1520)
        // 1519: fechaEmision con más de 30 días de antigüedad → rechazo
        // 1520: fechaEmision con más de 2 días hábiles en el futuro → rechazo
        const fechaEmisionStr = documento.datosTransaccion?.fechaEmision;
        if (fechaEmisionStr) {
            const fechaEmision = new Date(fechaEmisionStr);
            if (!isNaN(fechaEmision.getTime())) {
                const hoy = new Date();
                const diasAtras = diffCalendarDays(fechaEmision, hoy); // positivo = pasado
                const limiteHabilesFuturo = addBusinessDays(hoy, 2);

                if (diasAtras > 30) {
                    issues.push({
                        field: 'datosTransaccion.fechaEmision',
                        message:
                            `La fecha de emisión tiene ${diasAtras} días de antigüedad. ` +
                            `La DGI solo acepta documentos de hasta 30 días anteriores a la transmisión ` +
                            `(rechazo DGI 1519). Use tipoEmision '02' o '04' para documentos en contingencia.`,
                        code: 'DGI_1519',
                    });
                } else if (fechaEmision > limiteHabilesFuturo) {
                    issues.push({
                        field: 'datosTransaccion.fechaEmision',
                        message:
                            `La fecha de emisión (${fechaEmision.toISOString().slice(0, 10)}) supera ` +
                            `el límite de 2 días hábiles hacia el futuro ` +
                            `(rechazo DGI 1520). Verifique la fecha del documento.`,
                        code: 'DGI_1520',
                    });
                }
            }
        }

        // Contingencia: campos obligatorios cuando tipoEmision='02' o '04'
        // Si se omiten, HKA rechazará el documento con error de validación 109.
        const { tipoEmision, fechaInicioContingencia, motivoContingencia } = documento.datosTransaccion ?? {};
        if (tipoEmision === '02' || tipoEmision === '04') {
            if (!fechaInicioContingencia) {
                issues.push({
                    field: 'datosTransaccion.fechaInicioContingencia',
                    message: `fechaInicioContingencia es OBLIGATORIO cuando tipoEmision='${tipoEmision}' (contingencia). ` +
                        `Debe ser la fecha/hora ISO en que inició la contingencia.`,
                    code: 'CONTINGENCIA_FECHA_REQUERIDA',
                });
            }
            if (!motivoContingencia || motivoContingencia.trim().length < 15) {
                issues.push({
                    field: 'datosTransaccion.motivoContingencia',
                    message: `motivoContingencia es OBLIGATORIO cuando tipoEmision='${tipoEmision}' y debe tener ` +
                        `al menos 15 caracteres (actual: ${motivoContingencia?.trim().length ?? 0}).`,
                    code: 'CONTINGENCIA_MOTIVO_REQUERIDO',
                });
            }
            if (motivoContingencia && motivoContingencia.trim().length > 250) {
                issues.push({
                    field: 'datosTransaccion.motivoContingencia',
                    message: `motivoContingencia no puede exceder 250 caracteres (actual: ${motivoContingencia.trim().length}).`,
                    code: 'CONTINGENCIA_MOTIVO_DEMASIADO_LARGO',
                });
            }
        }

        return issues;
    }

    /**
     * Validate RUC for Contribuyente type
     */
    protected validateContribuyente(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const cliente = documento.datosTransaccion?.cliente;

        if (cliente?.tipoClienteFE === '01' || cliente?.tipoClienteFE === '03') {
            const clienteContrib = cliente as { numeroRUC?: string; digitoVerificadorRUC?: string };
            if (!clienteContrib.numeroRUC) {
                issues.push({
                    field: 'datosTransaccion.cliente.numeroRUC',
                    message: 'RUC es requerido para contribuyentes'
                });
            }
            if (!clienteContrib.digitoVerificadorRUC) {
                issues.push({
                    field: 'datosTransaccion.cliente.digitoVerificadorRUC',
                    message: 'Dígito verificador es requerido para contribuyentes'
                });
            }
        }

        return issues;
    }

    validate(documento: DocumentoElectronico): DocumentValidationResult {
        const issues = [
            ...this.validateCommon(documento),
            ...this.validateSpecific(documento),
        ];

        return {
            isValid: issues.length === 0,
            issues,
        };
    }

    /**
     * Specific validations for this document type (to be implemented by subclasses)
     */
    protected abstract validateSpecific(documento: DocumentoElectronico): ValidationIssue[];
}

// ============================================
// FACTURA VALIDATOR (01)
// ============================================

export class FacturaValidator extends BaseDocumentValidator {
    getDocumentType(): TipoDocumento {
        return '01';
    }

    getRequiredFields(): string[] {
        return [
            'datosTransaccion.cliente.tipoClienteFE',
            'listaItems',
            'totalesSubTotales.totalFactura',
            'totalesSubTotales.listaFormaPago',
        ];
    }

    protected validateSpecific(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const cliente = documento.datosTransaccion?.cliente;

        // Contribuyente validation
        issues.push(...this.validateContribuyente(documento));

        // Gobierno validation
        if (cliente?.tipoClienteFE === '03') {
            issues.push(...this.validateGobierno(documento));
        }

        return issues;
    }

    private validateGobierno(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // All items must have CPBS code and unit for government invoices
        documento.listaItems?.forEach((item: ItemFactura, index: number) => {
            if (!item.codigoCPBS && !item.codigoCPBSAbrev) {
                issues.push({
                    field: `listaItems[${index}].codigoCPBS`,
                    message: `Item ${index + 1}: Código CPBS es requerido para facturas a Gobierno`,
                });
            }
            if (!item.unidadMedidaCPBS) {
                issues.push({
                    field: `listaItems[${index}].unidadMedidaCPBS`,
                    message: `Item ${index + 1}: Unidad de medida CPBS es requerida para facturas a Gobierno`,
                });
            }
        });

        return issues;
    }
}

// ============================================
// NOTA DE CRÉDITO VALIDATOR (04=referenciada, 06=genérica)
// ============================================

export class NotaCreditoValidator extends BaseDocumentValidator {
    getDocumentType(): TipoDocumento {
        return '02';
    }

    getRequiredFields(): string[] {
        return [
            'datosTransaccion.cliente.tipoClienteFE',
            'listaItems',
            'totalesSubTotales.totalFactura',
            'totalesSubTotales.listaFormaPago',
        ];
    }

    protected validateSpecific(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Contribuyente validation
        issues.push(...this.validateContribuyente(documento));

        const tipoDoc = documento.datosTransaccion?.tipoDocumento as HKATipoDocumento;

        // Tipo 04 (NC referenciada): gDFRef es OBLIGATORIO
        if (tipoDoc === '04') {
            if (!documento.listaDocsFiscalReferenciados || documento.listaDocsFiscalReferenciados.length === 0) {
                issues.push({
                    field: 'listaDocsFiscalReferenciados',
                    message: 'Para Nota de Crédito tipo 04 (referenciada), el grupo de documentos referenciados (gDFRef) es obligatorio.',
                });
            } else {
                // Validar cada referencia
                issues.push(...this.validateReferences(documento.listaDocsFiscalReferenciados));
            }
        }

        // Tipo 06 (NC genérica): gDFRef está PROHIBIDO
        if (tipoDoc === '06') {
            if (documento.listaDocsFiscalReferenciados && documento.listaDocsFiscalReferenciados.length > 0) {
                issues.push({
                    field: 'listaDocsFiscalReferenciados',
                    message: 'Para Nota de Crédito tipo 06 (genérica), el grupo de documentos referenciados (gDFRef) está PROHIBIDO. La DGI rechazará el documento.',
                });
            }
        }

        return issues;
    }

    /**
     * Valida las referencias de documentos fiscales
     */
    public validateReferences(refs: import('../types/types').DocumentoFiscalReferenciado[]): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        if (refs.length > 99) {
            issues.push({
                field: 'listaDocsFiscalReferenciados',
                message: 'Máximo 99 documentos referenciados permitidos.',
            });
        }

        const cufes: string[] = [];
        refs.forEach((ref, index) => {
            if (!ref.fechaEmisionDocFiscalReferenciado) {
                issues.push({
                    field: `listaDocsFiscalReferenciados[${index}].fechaEmisionDocFiscalReferenciado`,
                    message: `Referencia ${index + 1}: Fecha del documento original es requerida.`,
                });
            }
            if (ref.cufeFEReferenciada) {
                if (ref.cufeFEReferenciada.length !== 66) {
                    issues.push({
                        field: `listaDocsFiscalReferenciados[${index}].cufeFEReferenciada`,
                        message: `Referencia ${index + 1}: CUFE debe tener exactamente 66 caracteres (tiene ${ref.cufeFEReferenciada.length}).`,
                    });
                }
                cufes.push(ref.cufeFEReferenciada);
            } else {
                 issues.push({
                    field: `listaDocsFiscalReferenciados[${index}].cufeFEReferenciada`,
                    message: `Referencia ${index + 1}: CUFE es requerido para documento referido.`,
                });
            }
        });

        // Validar CUFEs únicos
        const uniqueCufes = new Set(cufes);
        if (uniqueCufes.size !== cufes.length) {
            issues.push({
                field: 'listaDocsFiscalReferenciados',
                message: 'El mismo CUFE no puede aparecer duplicado dentro de las referencias.',
            });
        }

        return issues;
    }
}

// ============================================
// NOTA DE DÉBITO VALIDATOR (05=referenciada, 07=genérica)
// ============================================

export class NotaDebitoValidator extends BaseDocumentValidator {
    getDocumentType(): TipoDocumento {
        return '03';
    }

    getRequiredFields(): string[] {
        return [
            'datosTransaccion.cliente.tipoClienteFE',
            'listaItems',
            'totalesSubTotales.totalFactura',
            'totalesSubTotales.listaFormaPago',
        ];
    }

    protected validateSpecific(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Contribuyente validation
        issues.push(...this.validateContribuyente(documento));

        const tipoDoc = documento.datosTransaccion?.tipoDocumento as HKATipoDocumento;

        // Tipo 05 (ND referenciada): gDFRef es OBLIGATORIO
        if (tipoDoc === '05') {
            if (!documento.listaDocsFiscalReferenciados || documento.listaDocsFiscalReferenciados.length === 0) {
                issues.push({
                    field: 'listaDocsFiscalReferenciados',
                    message: 'Para Nota de Débito tipo 05 (referenciada), el grupo de documentos referenciados (gDFRef) es obligatorio.',
                });
            } else {
                const ncValidator = new NotaCreditoValidator();
                issues.push(...ncValidator.validateReferences(documento.listaDocsFiscalReferenciados));
            }
        }

        // Tipo 07 (ND genérica): gDFRef está PROHIBIDO
        if (tipoDoc === '07') {
            if (documento.listaDocsFiscalReferenciados && documento.listaDocsFiscalReferenciados.length > 0) {
                issues.push({
                    field: 'listaDocsFiscalReferenciados',
                    message: 'Para Nota de Débito tipo 07 (genérica), el grupo de documentos referenciados (gDFRef) está PROHIBIDO.',
                });
            }
        }

        return issues;
    }
}

// ============================================
// FACTURA DE EXPORTACIÓN VALIDATOR (03 tipo doc / 04 val)
// ============================================

export class ExportacionValidator extends BaseDocumentValidator {
    getDocumentType(): TipoDocumento {
        return '04';
    }

    getRequiredFields(): string[] {
        return [
            'datosTransaccion.cliente.tipoClienteFE',
            'listaItems',
            'totalesSubTotales.totalFactura',
            'totalesSubTotales.listaFormaPago',
            'datosTransaccion.destinoOperacion', // Should be '2' for export
        ];
    }

    protected validateSpecific(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const cliente = documento.datosTransaccion?.cliente;

        // Destination should be foreign for export invoices
        if (documento.datosTransaccion?.destinoOperacion !== '2') {
            issues.push({
                field: 'datosTransaccion.destinoOperacion',
                message: 'Destino de operación debe ser "2" (Extranjero) para Facturas de Exportación',
            });
        }

        // Client should typically be foreign for exports
        if (cliente?.tipoClienteFE !== '04') {
            issues.push({
                field: 'datosTransaccion.cliente.tipoClienteFE',
                message: 'Cliente debería ser tipo "04" (Extranjero) para Facturas de Exportación',
                code: 'WARNING',
            });
        }

        // gFExp — Grupo de Exportación es OBLIGATORIO cuando destinoOperacion='2'
        if (!documento.grupoExportacion) {
            issues.push({
                field: 'grupoExportacion',
                message: 'Grupo de Exportación (gFExp) es obligatorio para Facturas de Exportación (tipoDocumento 03). Debe incluir al menos cCondEntr (INCOTERMS).',
            });
        } else {
            // cCondEntr (INCOTERMS) es obligatorio dentro de gFExp
            if (!documento.grupoExportacion.cCondEntr) {
                issues.push({
                    field: 'grupoExportacion.cCondEntr',
                    message: 'Condición de entrega INCOTERMS (cCondEntr) es obligatorio en el Grupo de Exportación.',
                });
            }
            // Si hay moneda distinta de USD, tasa de cambio es obligatoria
            if (documento.grupoExportacion.cMoneda && documento.grupoExportacion.cMoneda !== 'USD') {
                if (!documento.grupoExportacion.dCambio) {
                    issues.push({
                        field: 'grupoExportacion.dCambio',
                        message: 'Tasa de cambio (dCambio) es obligatoria cuando la moneda no es USD.',
                    });
                }
            }
            // Si moneda es ZZZ, descripción es obligatoria
            if (documento.grupoExportacion.cMoneda === 'ZZZ' && !documento.grupoExportacion.cMonedaDesc) {
                issues.push({
                    field: 'grupoExportacion.cMonedaDesc',
                    message: 'Descripción de moneda (cMonedaDesc) es obligatoria cuando cMoneda="ZZZ".',
                });
            }
            // Si hay moneda, monto total en moneda extranjera es obligatorio
            if (documento.grupoExportacion.cMoneda && !documento.grupoExportacion.dVTotEst) {
                issues.push({
                    field: 'grupoExportacion.dVTotEst',
                    message: 'Monto total en moneda extranjera (dVTotEst) es obligatorio cuando se especifica cMoneda.',
                });
            }
        }

        return issues;
    }
}

// ============================================
// FACTURA DE IMPORTACIÓN VALIDATOR (DGI tipo 02)
// ============================================

export class ImportacionValidator extends BaseDocumentValidator {
    getDocumentType(): TipoDocumento {
        return '05';
    }

    getRequiredFields(): string[] {
        return [
            'datosTransaccion.cliente.tipoClienteFE',
            'listaItems',
            'totalesSubTotales.totalFactura',
            'totalesSubTotales.listaFormaPago',
        ];
    }

    protected validateSpecific(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        issues.push(...this.validateContribuyente(documento));

        // Importación: destinoOperacion DEBE ser '1' (Panamá)
        if (documento.datosTransaccion?.destinoOperacion === '2') {
            issues.push({
                field: 'datosTransaccion.destinoOperacion',
                message: 'Destino de operación debe ser "1" (Panamá) para Facturas de Importación.',
            });
        }

        // gFExp está PROHIBIDO para importación (Rechazo DGI 1650)
        if (documento.grupoExportacion) {
            issues.push({
                field: 'grupoExportacion',
                message: 'Grupo de Exportación (gFExp) está PROHIBIDO para Facturas de Importación (Rechazo DGI 1650).',
            });
        }

        return issues;
    }
}

// ============================================
// FACTURA DE ZONA FRANCA VALIDATOR (DGI tipo 08)
// ============================================

export class ZonaFrancaValidator extends BaseDocumentValidator {
    getDocumentType(): TipoDocumento {
        return '06';
    }

    getRequiredFields(): string[] {
        return [
            'datosTransaccion.cliente.tipoClienteFE',
            'listaItems',
            'totalesSubTotales.totalFactura',
            'totalesSubTotales.listaFormaPago',
        ];
    }

    protected validateSpecific(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        issues.push(...this.validateContribuyente(documento));

        // gDFRef en Zona Franca genera Notificación 1708 (no rechazo), solo warning
        if (documento.listaDocsFiscalReferenciados && documento.listaDocsFiscalReferenciados.length > 0) {
            issues.push({
                field: 'listaDocsFiscalReferenciados',
                message: 'gDFRef en Factura de Zona Franca generará Notificación DGI 1708.',
                code: 'WARNING',
            });
        }

        return issues;
    }
}

// ============================================
// REEMBOLSO VALIDATOR (DGI tipo 09)
// ============================================

export class ReembolsoValidator extends BaseDocumentValidator {
    getDocumentType(): TipoDocumento {
        return '07';
    }

    getRequiredFields(): string[] {
        return [
            'datosTransaccion.cliente.tipoClienteFE',
            'listaItems',
            'totalesSubTotales.totalFactura',
            'totalesSubTotales.listaFormaPago',
        ];
    }

    protected validateSpecific(documento: DocumentoElectronico): ValidationIssue[] {
        // Reembolso: gDFRef NO es obligatorio (solo para tipos 04/05)
        return this.validateContribuyente(documento);
    }
}

// ============================================
// FACTURA EXTRANJERA VALIDATOR (DGI tipo 10)
// ============================================

export class ExtranjeraValidator extends BaseDocumentValidator {
    getDocumentType(): TipoDocumento {
        return '08';
    }

    getRequiredFields(): string[] {
        return [
            'datosTransaccion.cliente.tipoClienteFE',
            'listaItems',
            'totalesSubTotales.totalFactura',
            'totalesSubTotales.listaFormaPago',
        ];
    }

    protected validateSpecific(documento: DocumentoElectronico): ValidationIssue[] {
        const issues: ValidationIssue[] = [];

        // Si destino='2' (Extranjero), gFExp es OBLIGATORIO (Rechazo DGI 1651)
        if (documento.datosTransaccion?.destinoOperacion === '2') {
            if (!documento.grupoExportacion) {
                issues.push({
                    field: 'grupoExportacion',
                    message: 'Grupo de Exportación (gFExp) es obligatorio para Factura Extranjera con destino="2" (Rechazo DGI 1651).',
                });
            } else if (!documento.grupoExportacion.cCondEntr) {
                issues.push({
                    field: 'grupoExportacion.cCondEntr',
                    message: 'Condición de entrega INCOTERMS (cCondEntr) es obligatorio en gFExp.',
                });
            }
        }

        // Si destino='1', gFExp PROHIBIDO (Rechazo DGI 1650)
        if (documento.datosTransaccion?.destinoOperacion === '1' && documento.grupoExportacion) {
            issues.push({
                field: 'grupoExportacion',
                message: 'Grupo de Exportación (gFExp) está PROHIBIDO cuando destino="1" (Rechazo DGI 1650).',
            });
        }

        return issues;
    }
}

// ============================================
// VALIDATOR FACTORY
// ============================================

/**
 * Get the appropriate validator for a document type
 */
export function getValidator(tipoDocumento: TipoDocumento): IDocumentValidator {
    switch (tipoDocumento) {
        case '01':
            return new FacturaValidator();
        case '02':
            return new NotaCreditoValidator();
        case '03':
            return new NotaDebitoValidator();
        case '04':
            return new ExportacionValidator();
        case '05':
            return new ImportacionValidator();
        case '06':
            return new ZonaFrancaValidator();
        case '07':
            return new ReembolsoValidator();
        case '08':
            return new ExtranjeraValidator();
        default:
            return new FacturaValidator();
    }
}

/**
 * Validate a document with the appropriate validator
 * Returns Result type for consistent error handling
 */
export function validateDocument(
    documento: DocumentoElectronico,
    tipoDocumento?: TipoDocumento
): Result<void, ValidationError> {
    const tipo = tipoDocumento || (documento.datosTransaccion?.tipoDocumento as TipoDocumento) || '01';
    const validator = getValidator(tipo);
    const result = validator.validate(documento);

    if (!result.isValid) {
        // Filter out warnings for the error
        const errors = result.issues.filter(i => i.code !== 'WARNING');
        if (errors.length > 0) {
            const errorMessages = errors.map(i => `${i.field}: ${i.message}`);
            return Err(new ValidationError('documento', errorMessages));
        }
    }

    return Ok(undefined);
}

// ============================================
// EXPORTS
// ============================================

export const DocumentValidators = {
    Factura: FacturaValidator,
    NotaCredito: NotaCreditoValidator,
    NotaDebito: NotaDebitoValidator,
    Exportacion: ExportacionValidator,
    Importacion: ImportacionValidator,
    ZonaFranca: ZonaFrancaValidator,
    Reembolso: ReembolsoValidator,
    Extranjera: ExtranjeraValidator,
    getValidator,
    validateDocument,
};
